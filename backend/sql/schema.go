package schema

import _ "embed"

//go:embed 001_create_scores.sql
var SQL []byte
