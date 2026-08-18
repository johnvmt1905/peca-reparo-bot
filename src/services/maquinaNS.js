/**
 * Lógica portada do Apps Script (Auvo → Sheets) pra lidar com a
 * inconsistência da base: às vezes o N.S está embutido no nome/descrição
 * do equipamento, às vezes é o próprio `identifier`.
 */

const PREFIXOS_INTERNOS_CONHECIDOS = new Set(require('./prefixosInternosConhecidos.json'));

const REGEX_NS = [
  /\bN\.?\s*S\.?\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9.\-/_]*)/i,
  /\bNS\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9.\-/_]*)/i,
  /\bN\/S\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9.\-/_]*)/i,
  // N° / Nº (grau/ordinal), com ou sem "DE SÉRIE" escrito por extenso —
  // confirmado na base real (ex: "N° DE SÉRIE: BQD0119094", "N°790/06")
  /\bN[°º]\.?\s*(?:DE\s*S[ÉE]RIE)?\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9.\-/]*)/i,
  // "Número de série" por extenso, sem abreviação
  /\bN[uú]mero\s*de\s*s[ée]rie\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9.\-/]*)/i,
];

const CHAVES_EQ_TEXTO = ['equipmentDescription', 'equipmentName', 'assetDescription', 'assetName', 'equipamento', 'maquina'];
const CHAVES_EQ_NOME = ['name', 'equipmentName', 'model', 'modelo'];
const CHAVES_EQ_DESC = ['description', 'equipmentDescription'];
const CHAVES_EQ_NS = ['identifier', 'serialNumber', 'serial', 'ns', 'numeroSerie', 'numeroDeSerie', 'externalId'];

function primeiroValido(obj, chaves) {
  if (!obj) return '';
  for (const chave of chaves) {
    const v = obj[chave];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function extrairNSDoTexto(texto) {
  if (!texto) return '';
  for (const regex of REGEX_NS) {
    const m = String(texto).match(regex);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function removerNSDoTexto(texto) {
  if (!texto) return '';
  let str = String(texto).trim();
  str = str.replace(/\s*[-–—]?\s*\bN\.?\s*S\.?\s*[:.\-]?\s*[A-Za-z0-9][A-Za-z0-9.\-/_]*\s*$/i, '');
  str = str.replace(/\s*[-–—]?\s*\bNS\s*[:.\-]?\s*[A-Za-z0-9][A-Za-z0-9.\-/_]*\s*$/i, '');
  str = str.replace(/\s*[-–—]?\s*\bN\/S\s*[:.\-]?\s*[A-Za-z0-9][A-Za-z0-9.\-/_]*\s*$/i, '');
  str = str.replace(/\s*[-–—]?\s*\bN[°º]\.?\s*(?:DE\s*S[ÉE]RIE)?\s*[:.\-]?\s*[A-Za-z0-9][A-Za-z0-9.\-/]*\s*$/i, '');
  str = str.replace(/\s*[-–—]?\s*\bN[uú]mero\s*de\s*s[ée]rie\s*[:.\-]?\s*[A-Za-z0-9][A-Za-z0-9.\-/]*\s*$/i, '');
  return str.trim();
}

/**
 * Textos que indicam explicitamente "sem valor" — usá-los como N.S seria
 * pior do que deixar em branco (ex: identifier = "S/N" ou "N.S -", onde o
 * prefixo existe mas o valor não foi preenchido).
 */
const PLACEHOLDERS_VAZIOS = ['s/n', 'sn', 'não informado', 'nao informado', 'n.s', 'n.s.', 'ns', '-', ''];

function pareceValorVazio(valor) {
  const str = String(valor || '').trim().toLowerCase();
  if (PLACEHOLDERS_VAZIOS.includes(str)) return true;
  // prefixo de N.S presente mas sem valor depois (ex: "N.S -", "Nº:")
  if (/^n[.\s]*[s°º/]*\s*[:.\-]*\s*$/i.test(str)) return true;
  return false;
}

/** Identifica registros "container" (agrupador de cliente/empresa, não uma máquina de verdade). */
function pareceContainer(nome, descricao) {
  const texto = `${nome} ${descricao}`.toUpperCase();
  return texto.includes('GERAL') || /^CLIENTE\b/.test(nome.trim().toUpperCase()) || /^CLIENTE\b/.test(descricao.trim().toUpperCase());
}

/**
 * Código interno de cliente na base de vocês (ex: "FAI013", "GMR000"):
 * poucas letras + 2-4 dígitos, ONDE o prefixo de letras se repete em
 * outros equipamentos da base (ex: FAI000, FAI001... FAI020 — claramente
 * uma numeração sequencial, não um N.S de fábrica). Um identifier com essa
 * mesma forma mas prefixo que NUNCA se repete (ex: "QF7464", único na
 * base) é tratado como N.S genuíno — essa é a lista compilada a partir do
 * export `equipamentos_27_07_2026.csv` (335 prefixos confirmados como
 * código interno). Precisa ser regenerada se a base mudar muito.
 */
function pareceCodigoInterno(valor) {
  const str = String(valor || '').trim();
  const m = str.match(/^([A-Za-z]{1,4})[\s\-_]?\d{2,4}$/);
  if (!m) return false;
  return PREFIXOS_INTERNOS_CONHECIDOS.has(m[1].toUpperCase());
}

function removerPrefixo(texto, identifier) {
  if (!texto || !identifier) return texto || '';
  const escaped = String(identifier).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(texto).replace(new RegExp(`^\\s*${escaped}\\s*[-–—:]\\s*`, 'i'), '').trim();
}

/**
 * A partir do objeto de equipamento retornado pela Auvo, devolve
 * { maquina, nsMaquina } já separados.
 */
function extrairMaquinaENs(equipamento) {
  if (!equipamento || typeof equipamento !== 'object') return { maquina: '', nsMaquina: '' };

  const nome = primeiroValido(equipamento, CHAVES_EQ_NOME);
  const descricao = primeiroValido(equipamento, CHAVES_EQ_DESC);
  const identifier = primeiroValido(equipamento, CHAVES_EQ_NS);

  let ns = extrairNSDoTexto(nome) || extrairNSDoTexto(descricao) || extrairNSDoTexto(identifier);
  if (
    !ns &&
    identifier &&
    !pareceValorVazio(identifier) &&
    !pareceContainer(nome, descricao) &&
    !pareceCodigoInterno(identifier)
  ) {
    // Preenche como N.S mesmo sem prefixo reconhecido — mas só quando o
    // identifier NÃO tem cara de código interno de cliente (curto, poucas
    // letras + poucos dígitos). Isso evita repetir o erro do "FAI013"
    // (código de cliente na GM Reis) enquanto ainda pega N.S genuínos mais
    // longos/complexos que não têm prefixo nenhum.
    ns = identifier;
  }

  const nomeBase = nome || descricao || '';
  let nomeLimpo = removerNSDoTexto(nomeBase);
  nomeLimpo = removerPrefixo(nomeLimpo, identifier);

  return { maquina: nomeLimpo, nsMaquina: ns };
}

module.exports = { primeiroValido, extrairMaquinaENs, CHAVES_EQ_TEXTO };