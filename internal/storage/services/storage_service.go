package services

import (
	"database/sql"
	"fmt"
)

type StorageService struct {
	db *sql.DB
}

func NewStorageService(db *sql.DB) *StorageService {
	return &StorageService{db: db}
}

func (s *StorageService) QueryRaw(query string) (*sql.Rows, error) {
	return s.db.Query(query)
}

func (s *StorageService) CreateSnapshot(path string) error {
	// DuckDB specific snapshot command
	_, err := s.db.Exec("EXPORT DATABASE ? (FORMAT SQL)", path)
	if err != nil {
		// Fallback for some DuckDB versions
		_, err = s.db.Exec(fmt.Sprintf("CHECKPOINT; COPY FROM (SELECT *) TO '%s' (FORMAT 'PARQUET')", path))
	}
	return err
}
