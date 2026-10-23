CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY,
  contribuinte TEXT NOT NULL,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  dados TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resultados (
  benchmark_id TEXT NOT NULL REFERENCES benchmarks(id),
  contribuinte TEXT NOT NULL,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  componente TEXT NOT NULL,
  grupo TEXT NOT NULL,
  tipo TEXT,
  marca TEXT,
  modelo TEXT,
  frequencia REAL,
  hardware TEXT NOT NULL,
  configuracao TEXT NOT NULL,
  pontuacao REAL,
  resumo TEXT NOT NULL,
  elegivel INTEGER NOT NULL,
  PRIMARY KEY (benchmark_id, componente)
);
CREATE INDEX IF NOT EXISTS resultados_grupo ON resultados(grupo, elegivel, contribuinte, criado);
CREATE INDEX IF NOT EXISTS resultados_filtro ON resultados(componente, tipo, marca, modelo);
