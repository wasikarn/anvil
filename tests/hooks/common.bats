#!/usr/bin/env bats

load setup

setup() {
  # shellcheck source=hooks/lib/common.sh
  source "$LIB_DIR/common.sh"
}

@test "require_jq: exits 0 when jq is installed" {
  run bash -c "source $LIB_DIR/common.sh; require_jq; echo ok"
  [ "$status" -eq 0 ]
  [ "$output" = "ok" ]
}

@test "has_evidence: returns 0 for file.sh:42" {
  run bash -c "source $LIB_DIR/common.sh; has_evidence 'hooks/task-gate.sh:42'"
  [ "$status" -eq 0 ]
}

@test "has_evidence: returns 0 for nested/path/file.ts:100" {
  run bash -c "source $LIB_DIR/common.sh; has_evidence 'src/api/handler.ts:100'"
  [ "$status" -eq 0 ]
}

@test "has_evidence: returns 1 for plain text with no file:line" {
  run bash -c "source $LIB_DIR/common.sh; has_evidence 'no reference here'"
  [ "$status" -eq 1 ]
}

@test "has_evidence: returns 1 for empty string" {
  run bash -c "source $LIB_DIR/common.sh; has_evidence ''"
  [ "$status" -eq 1 ]
}

@test "has_evidence: returns 1 for filename without line number" {
  run bash -c "source $LIB_DIR/common.sh; has_evidence 'hooks/common.sh'"
  [ "$status" -eq 1 ]
}

@test "jq_fields: extracts single field" {
  run bash -c "
    source $LIB_DIR/common.sh
    INPUT='{\"tool\":\"Bash\"}'
    export INPUT
    jq_fields '.tool'
  "
  [ "$status" -eq 0 ]
  [ "$output" = "Bash" ]
}

@test "jq_fields: extracts two fields as TSV" {
  run bash -c "
    source $LIB_DIR/common.sh
    INPUT='{\"tool\":\"Edit\",\"error\":\"not found\"}'
    export INPUT
    jq_fields '.tool' '.error'
  "
  [ "$status" -eq 0 ]
  [ "$output" = "Edit	not found" ]
}

@test "jq_fields: returns empty string for missing field" {
  run bash -c "
    source $LIB_DIR/common.sh
    INPUT='{\"tool\":\"Bash\"}'
    export INPUT
    jq_fields '.missing'
  "
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

@test "jq_fields: field value with spaces is preserved as single column" {
  run bash -c "
    source $LIB_DIR/common.sh
    INPUT='{\"command\":\"npm run test\"}'
    export INPUT
    IFS=\$'\\t' read -r CMD < <(jq_fields '.command')
    echo \"\$CMD\"
  "
  [ "$status" -eq 0 ]
  [ "$output" = "npm run test" ]
}

@test "jq_fields: fails with error when called with no args" {
  run bash -c "
    source $LIB_DIR/common.sh
    INPUT='{}'
    export INPUT
    jq_fields
  "
  [ "$status" -ne 0 ]
  [[ "$output" =~ "requires at least one filter" ]]
}
