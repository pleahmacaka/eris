use std::collections::HashMap;
use std::io::{self, BufRead, Read};

const STRING_LIMIT: u64 = 16 * 1024 * 1024;

const DEPTH_LIMIT: u16 = 64;

#[derive(Clone)]
pub enum Value {
    None,
    Bool(bool),
    Int(i64),
    Float(f64),
    Str(String),
    Bytes,
    Tuple(Vec<Value>),
    List(Vec<Value>),
    Dict(Vec<(Value, Value)>),
    Global(String),
    Object {
        class: String,
        args: Vec<Value>,
        items: Vec<(Value, Value)>,
    },
    Persistent(Box<Value>),
    Mark,
}

#[derive(Clone)]
struct Slot {
    value: Value,
    depth: u16,
}

struct Machine<R> {
    reader: R,
    stack: Vec<Slot>,
    memo: HashMap<u32, Slot>,
}

// Values are built without ever resolving a global, so nothing in the file can run.
pub fn load(reader: impl BufRead) -> Option<Value> {
    Machine {
        reader,
        stack: Vec::new(),
        memo: HashMap::new(),
    }
    .run()
}

fn deepest(values: &[Slot]) -> u16 {
    values.iter().map(|slot| slot.depth).max().unwrap_or(0)
}

fn values(slots: Vec<Slot>) -> Vec<Value> {
    slots.into_iter().map(|slot| slot.value).collect()
}

fn pairs(values: Vec<Value>) -> Vec<(Value, Value)> {
    let mut values = values.into_iter();
    let mut pairs = Vec::new();

    while let (Some(key), Some(value)) = (values.next(), values.next()) {
        pairs.push((key, value));
    }

    pairs
}

fn args(value: Value) -> Vec<Value> {
    match value {
        Value::Tuple(items) | Value::List(items) => items,
        _ => Vec::new(),
    }
}

impl<R: BufRead> Machine<R> {
    fn bytes<const N: usize>(&mut self) -> Option<[u8; N]> {
        let mut bytes = [0; N];
        self.reader.read_exact(&mut bytes).ok()?;

        Some(bytes)
    }

    fn u8(&mut self) -> Option<u8> {
        Some(self.bytes::<1>()?[0])
    }

    fn u16(&mut self) -> Option<u16> {
        Some(u16::from_le_bytes(self.bytes()?))
    }

    fn u32(&mut self) -> Option<u32> {
        Some(u32::from_le_bytes(self.bytes()?))
    }

    fn u64(&mut self) -> Option<u64> {
        Some(u64::from_le_bytes(self.bytes()?))
    }

    fn string(&mut self, length: u64) -> Option<String> {
        let bytes = self.string_bytes(length)?;

        Some(String::from_utf8_lossy(&bytes).into_owned())
    }

    fn skip(&mut self, length: u64) -> Option<Value> {
        let copied = io::copy(&mut (&mut self.reader).take(length), &mut io::sink()).ok()?;

        (copied == length).then_some(Value::Bytes)
    }

    fn line(&mut self) -> Option<String> {
        let mut line = Vec::new();
        (&mut self.reader)
            .take(STRING_LIMIT)
            .read_until(b'\n', &mut line)
            .ok()?;

        Some(String::from_utf8_lossy(line.strip_suffix(b"\n")?).into_owned())
    }

    fn long(&mut self, length: u64) -> Option<Value> {
        let bytes = self.string_bytes(length)?;

        if bytes.len() > 8 {
            return Some(Value::Int(0));
        }

        let negative = bytes.last().is_some_and(|byte| byte & 0x80 != 0);
        let mut padded = [if negative { 0xFF } else { 0 }; 8];
        padded[..bytes.len()].copy_from_slice(&bytes);

        Some(Value::Int(i64::from_le_bytes(padded)))
    }

    fn string_bytes(&mut self, length: u64) -> Option<Vec<u8>> {
        if length > STRING_LIMIT {
            return None;
        }

        let mut bytes = vec![0; length as usize];
        self.reader.read_exact(&mut bytes).ok()?;

        Some(bytes)
    }

    fn push(&mut self, value: Value) {
        self.stack.push(Slot { value, depth: 0 });
    }

    fn nest(&mut self, value: Value, children: u16) -> Option<()> {
        let depth = children + 1;

        if depth > DEPTH_LIMIT {
            return None;
        }

        self.stack.push(Slot { value, depth });

        Some(())
    }

    fn pop(&mut self) -> Option<Slot> {
        self.stack.pop()
    }

    fn pop_mark(&mut self) -> Option<Vec<Slot>> {
        let mark = self
            .stack
            .iter()
            .rposition(|slot| matches!(slot.value, Value::Mark))?;
        let items = self.stack.split_off(mark + 1);
        self.stack.pop();

        Some(items)
    }

    fn top(&mut self) -> Option<&mut Slot> {
        self.stack.last_mut()
    }

    fn reduce(&mut self, class: Slot, arguments: Slot) -> Option<()> {
        let children = class.depth.max(arguments.depth);
        let value = match class.value {
            Value::Global(name) if name == "collections.OrderedDict" => Value::Dict(Vec::new()),
            Value::Global(class) => Value::Object {
                class,
                args: args(arguments.value),
                items: Vec::new(),
            },
            _ => Value::None,
        };

        self.nest(value, children)
    }

    fn insert(&mut self, items: Vec<Slot>) -> Option<()> {
        let depth = deepest(&items) + 1;
        let top = self.top()?;

        if depth > DEPTH_LIMIT {
            return None;
        }

        top.depth = top.depth.max(depth);

        match &mut top.value {
            Value::Dict(entries) | Value::Object { items: entries, .. } => {
                entries.extend(pairs(values(items)));
            }
            _ => {}
        }

        Some(())
    }

    fn build(&mut self, state: Slot) -> Option<()> {
        let entries = match state.value {
            Value::Dict(entries) => entries,
            Value::Tuple(parts) => parts
                .into_iter()
                .flat_map(|part| match part {
                    Value::Dict(entries) => entries,
                    _ => Vec::new(),
                })
                .collect(),
            _ => Vec::new(),
        };

        let top = self.top()?;
        top.depth = top.depth.max(state.depth);

        if let Value::Object { items, .. } = &mut top.value {
            items.extend(entries);
        }

        Some(())
    }

    fn append(&mut self, items: Vec<Slot>) -> Option<()> {
        let depth = deepest(&items) + 1;
        let top = self.top()?;

        if depth > DEPTH_LIMIT {
            return None;
        }

        top.depth = top.depth.max(depth);

        if let Value::List(list) = &mut top.value {
            list.extend(values(items));
        }

        Some(())
    }

    fn remember(&mut self, key: u32) -> Option<()> {
        let top = self.stack.last()?.clone();
        self.memo.insert(key, top);

        Some(())
    }

    fn recall(&mut self, key: u32) -> Option<()> {
        let slot = self.memo.get(&key)?.clone();
        self.stack.push(slot);

        Some(())
    }

    fn tuple(&mut self, count: usize) -> Option<()> {
        let items = self.stack.split_off(self.stack.len().checked_sub(count)?);
        let depth = deepest(&items);

        self.nest(Value::Tuple(values(items)), depth)
    }

    fn run(mut self) -> Option<Value> {
        loop {
            match self.u8()? {
                0x80 => {
                    self.u8()?;
                }
                0x95 => {
                    self.u64()?;
                }
                b'(' => self.push(Value::Mark),
                b'}' => self.push(Value::Dict(Vec::new())),
                b']' | 0x8f => self.push(Value::List(Vec::new())),
                b')' => self.push(Value::Tuple(Vec::new())),
                b'N' => self.push(Value::None),
                0x88 => self.push(Value::Bool(true)),
                0x89 => self.push(Value::Bool(false)),
                b'J' => {
                    let value = i32::from_le_bytes(self.bytes()?);
                    self.push(Value::Int(value.into()));
                }
                b'K' => {
                    let value = self.u8()?;
                    self.push(Value::Int(value.into()));
                }
                b'M' => {
                    let value = self.u16()?;
                    self.push(Value::Int(value.into()));
                }
                0x8a => {
                    let length = self.u8()?;
                    let value = self.long(length.into())?;
                    self.push(value);
                }
                0x8b => {
                    let length = self.u32()?;
                    let value = self.long(length.into())?;
                    self.push(value);
                }
                b'G' => {
                    let value = f64::from_be_bytes(self.bytes()?);
                    self.push(Value::Float(value));
                }
                b'X' | b'T' => {
                    let length = self.u32()?;
                    let value = self.string(length.into())?;
                    self.push(Value::Str(value));
                }
                0x8c | b'U' => {
                    let length = self.u8()?;
                    let value = self.string(length.into())?;
                    self.push(Value::Str(value));
                }
                0x8d => {
                    let length = self.u64()?;
                    let value = self.string(length)?;
                    self.push(Value::Str(value));
                }
                b'C' => {
                    let length = self.u8()?;
                    let value = self.skip(length.into())?;
                    self.push(value);
                }
                b'B' => {
                    let length = self.u32()?;
                    let value = self.skip(length.into())?;
                    self.push(value);
                }
                0x8e | 0x96 => {
                    let length = self.u64()?;
                    let value = self.skip(length)?;
                    self.push(value);
                }
                b't' => {
                    let items = self.pop_mark()?;
                    let depth = deepest(&items);
                    self.nest(Value::Tuple(values(items)), depth)?;
                }
                0x85 => self.tuple(1)?,
                0x86 => self.tuple(2)?,
                0x87 => self.tuple(3)?,
                b'l' | 0x91 => {
                    let items = self.pop_mark()?;
                    let depth = deepest(&items);
                    self.nest(Value::List(values(items)), depth)?;
                }
                b'd' => {
                    let items = self.pop_mark()?;
                    let depth = deepest(&items);
                    self.nest(Value::Dict(pairs(values(items))), depth)?;
                }
                b'c' => {
                    let module = self.line()?;
                    let name = self.line()?;
                    self.push(Value::Global(format!("{module}.{name}")));
                }
                0x93 => {
                    let name = self.pop()?.value;
                    let module = self.pop()?.value;

                    let (Value::Str(module), Value::Str(name)) = (module, name) else {
                        return None;
                    };

                    self.push(Value::Global(format!("{module}.{name}")));
                }
                b'R' | 0x81 => {
                    let arguments = self.pop()?;
                    let class = self.pop()?;
                    self.reduce(class, arguments)?;
                }
                0x92 => {
                    self.pop()?;
                    let arguments = self.pop()?;
                    let class = self.pop()?;
                    self.reduce(class, arguments)?;
                }
                b'b' => {
                    let state = self.pop()?;
                    self.build(state)?;
                }
                b's' => {
                    let value = self.pop()?;
                    let key = self.pop()?;
                    self.insert(vec![key, value])?;
                }
                b'u' => {
                    let items = self.pop_mark()?;
                    self.insert(items)?;
                }
                b'a' => {
                    let value = self.pop()?;
                    self.append(vec![value])?;
                }
                b'e' => {
                    let items = self.pop_mark()?;
                    self.append(items)?;
                }
                0x90 => {
                    self.pop_mark()?;
                }
                b'q' => {
                    let key = self.u8()?;
                    self.remember(key.into())?;
                }
                b'r' => {
                    let key = self.u32()?;
                    self.remember(key)?;
                }
                0x94 => {
                    let key = u32::try_from(self.memo.len()).ok()?;
                    self.remember(key)?;
                }
                b'h' => {
                    let key = self.u8()?;
                    self.recall(key.into())?;
                }
                b'j' => {
                    let key = self.u32()?;
                    self.recall(key)?;
                }
                b'Q' => {
                    let id = self.pop()?;
                    self.nest(Value::Persistent(Box::new(id.value)), id.depth)?;
                }
                b'0' => {
                    self.pop()?;
                }
                b'1' => {
                    self.pop_mark()?;
                }
                b'2' => {
                    let top = self.stack.last()?.clone();
                    self.stack.push(top);
                }
                b'.' => return self.pop().map(|slot| slot.value),
                _ => return None,
            }
        }
    }
}
