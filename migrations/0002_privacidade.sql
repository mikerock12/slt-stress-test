ALTER TABLE benchmarks ADD COLUMN consentimento_versao TEXT;
ALTER TABLE benchmarks ADD COLUMN consentido_em TEXT;
CREATE INDEX IF NOT EXISTS benchmarks_contribuinte ON benchmarks(contribuinte, criado);
CREATE TABLE IF NOT EXISTS revogacoes (
  contribuinte TEXT PRIMARY KEY,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER IF NOT EXISTS impedir_contribuicao_revogada
BEFORE INSERT ON benchmarks
WHEN EXISTS (SELECT 1 FROM revogacoes WHERE contribuinte = NEW.contribuinte)
BEGIN
  SELECT RAISE(ABORT, 'chave_revogada');
END;
