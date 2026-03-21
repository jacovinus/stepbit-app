package models

// API Models
type PaginationQuery struct {
	Limit  int `query:"limit"`
	Offset int `query:"offset"`
}

type SqlQueryRequest struct {
	SQL string `json:"sql"`
}

type SqlQueryResponse struct {
	Columns []string                 `json:"columns"`
	Rows    []map[string]interface{} `json:"rows"`
}
