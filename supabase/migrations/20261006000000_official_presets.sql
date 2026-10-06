insert into public.themes (slug, owner, author, name, description, swatch, appearance, tags)
values
  (
    'arix', null, 'Eris', 'Arix',
    'The Eris default: flat near-black with soft corners and a violet accent.',
    array['#131018', '#ac89e8', '#e8e7ed'],
    '{"mode":"dark","background":"solid","useSystemAccent":false,"accentHue":300,"accentSpread":0,"vividness":0.07,"texture":0,"radius":0.65,"blur":1,"density":"cozy"}',
    array['official', 'dark', 'minimal']
  ),
  (
    'aurora', null, 'Eris', 'Aurora',
    'Soft light drifting over deep blue, following your system mode.',
    array['#1b1b26', '#5b8def', '#a9c7ff'],
    '{"mode":"system","background":"aura","useSystemAccent":true,"accentHue":215,"accentSpread":14,"vividness":0.06,"texture":0.3,"radius":1,"blur":1,"density":"cozy"}',
    array['official', 'modern', 'cool']
  ),
  (
    'glass', null, 'Eris', 'Glass',
    'A light frosted surface with a blue accent.',
    array['#f3f5fb', '#6f97f5', '#dbe4ff'],
    '{"mode":"light","background":"glass","useSystemAccent":true,"accentHue":225,"accentSpread":24,"vividness":0.05,"texture":0.12,"radius":1.2,"blur":1.4,"density":"cozy"}',
    array['official', 'glass', 'light']
  ),
  (
    'system-accent', null, 'Eris', 'System Accent',
    'A solid surface tinted with the accent color you picked in Windows.',
    array['#202020', '#0078d4', '#3d3d3d'],
    '{"mode":"system","background":"solid","useSystemAccent":true,"accentHue":206,"accentSpread":0,"vividness":0.04,"texture":0.2,"radius":0.6,"blur":0.6,"density":"cozy"}',
    array['official', 'minimal', 'system']
  ),
  (
    'pastel-mauve', null, 'Eris', 'Pastel Mauve',
    'Soft pastel mauve and pink on a calm dark base.',
    array['#1e1e2e', '#cba6f7', '#f5c2e7'],
    '{"mode":"system","background":"aura","useSystemAccent":false,"accentHue":305,"accentSpread":40,"vividness":0.09,"texture":0.15,"radius":1.4,"blur":1.1,"density":"cozy"}',
    array['official', 'pastel', 'dark']
  ),
  (
    'night-orchid', null, 'Eris', 'Night Orchid',
    'Purple and pink on charcoal.',
    array['#282a36', '#bd93f9', '#ff79c6'],
    '{"mode":"system","background":"aura","useSystemAccent":false,"accentHue":290,"accentSpread":50,"vividness":0.14,"texture":0.25,"radius":0.8,"blur":1,"density":"cozy"}',
    array['official', 'dark', 'vivid']
  ),
  (
    'mono', null, 'Eris', 'Mono',
    'Greyscale with no accent and compact spacing.',
    array['#111111', '#9a9a9a', '#f2f2f2'],
    '{"mode":"system","background":"solid","useSystemAccent":false,"accentHue":0,"accentSpread":0,"vividness":0,"texture":0.4,"radius":0.25,"blur":0.5,"density":"compact"}',
    array['official', 'minimal', 'compact']
  ),
  (
    'neon', null, 'Eris', 'Neon',
    'Vivid magenta and cyan with rounded corners.',
    array['#0b0714', '#ff3cac', '#2bd2ff'],
    '{"mode":"system","background":"aura","useSystemAccent":false,"accentHue":325,"accentSpread":90,"vividness":0.2,"texture":0.15,"radius":1.6,"blur":1.3,"density":"cozy"}',
    array['official', 'vivid', 'dark']
  ),
  (
    'sunset', null, 'Eris', 'Sunset',
    'Orange and gold on a dusky base.',
    array['#2a1620', '#ff7a45', '#ffc46b'],
    '{"mode":"system","background":"aura","useSystemAccent":false,"accentHue":35,"accentSpread":45,"vividness":0.14,"texture":0.3,"radius":1.2,"blur":1.1,"density":"cozy"}',
    array['official', 'warm', 'dark']
  ),
  (
    'forest', null, 'Eris', 'Forest',
    'Mossy greens with a grainy texture.',
    array['#12201a', '#4fb47a', '#c8e6c9'],
    '{"mode":"system","background":"aura","useSystemAccent":false,"accentHue":150,"accentSpread":30,"vividness":0.09,"texture":0.4,"radius":0.9,"blur":0.9,"density":"cozy"}',
    array['official', 'green', 'texture']
  ),
  (
    'ocean', null, 'Eris', 'Ocean',
    'Deep teal currents with cyan highlights.',
    array['#0c1b24', '#2fb8c6', '#9fe3ec'],
    '{"mode":"system","background":"aura","useSystemAccent":false,"accentHue":200,"accentSpread":40,"vividness":0.11,"texture":0.2,"radius":1.1,"blur":1.2,"density":"cozy"}',
    array['official', 'cool', 'teal']
  )
on conflict (slug) do nothing;
