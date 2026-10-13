use std::fs::File;

use parquet::basic::ConvertedType;
use parquet::file::metadata::ParquetMetaDataReader;

use super::Summary;

const VALUE_LIMIT: usize = 300;

pub fn read(file: File) -> Option<Summary> {
    let metadata = ParquetMetaDataReader::new().parse_and_finish(&file).ok()?;
    let details = metadata.file_metadata();
    let rows = u64::try_from(details.num_rows()).unwrap_or(0);
    let mut summary = Summary {
        rows: Some(rows),
        ..Summary::default()
    };

    for column in details.schema_descr().columns() {
        let kind = match column.converted_type() {
            ConvertedType::NONE => column.physical_type().to_string(),
            converted => converted.to_string(),
        };

        summary.tensor(column.path().string(), kind.to_lowercase(), vec![rows]);
    }

    summary.meta("row_groups", metadata.num_row_groups().to_string());

    if let Some(creator) = details.created_by() {
        summary.meta("created_by", creator);
    }

    for entry in details.key_value_metadata().into_iter().flatten() {
        if entry.key == "ARROW:schema" {
            continue;
        }

        let value = entry.value.as_deref().unwrap_or_default();
        summary.meta(
            entry.key.clone(),
            value.chars().take(VALUE_LIMIT).collect::<String>(),
        );
    }

    Some(summary)
}
