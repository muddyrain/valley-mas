-- +goose Up
CALL valley_managed_add_column_if_missing(
  'resources', 'source_kind', "VARCHAR(24) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'resources', 'source_url', "VARCHAR(500) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'resources', 'license', "VARCHAR(32) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'resources', 'download_allowed', "BOOLEAN NOT NULL DEFAULT FALSE"
);
