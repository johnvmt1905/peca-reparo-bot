/**
 * Categorias do modal 1. "Outros" não faz nada extra; as outras aplicam uma
 * etiqueta no Trello e criam uma OS interna na Auvo (OS + 2 tarefas).
 *
 * IDs confirmados no teste de 19/10/2026:
 *  - statusId "Em Andamento": 070b4849-747a-11ee-bdb3-0ab8a76e2462
 *  - usuários: 243173 (Subconjunto), 249223 (Laboratório Eletrônico)
 *  - tipos de tarefa: Desmontagem/Montagem (Subconjunto) 253513/253512; (Eletrônica) 253514/253515
 *
 * A OS é criada com recorrência diária de 2 dias: a Auvo gera 1 tarefa por
 * dia DENTRO da OS (1ª = Desmontagem, 2ª = Montagem). O PATCH /tasks da Auvo
 * dá erro 500, mas o PUT /tasks com "id" atualiza a tarefa (testado), então o
 * bot ajusta tipo e orientação de cada uma depois que a OS é criada.
 */
const STATUS_EM_ANDAMENTO = '070b4849-747a-11ee-bdb3-0ab8a76e2462';

const CATEGORIAS = {
  subconjunto: {
    label: 'Subconjunto',
    trelloLabel: 'LAB MECÂNICO GZERO',
    descricaoOS: 'LAB MECÂNICO INTERNO',
    auvo: { userId: 243173, tipoDesmontagemId: 253513, tipoMontagemId: 253512 }, // Desmontagem/Montagem (Subconjunto)
  },
  eletronica: {
    label: 'Peça Eletrônica',
    trelloLabel: 'LAB ELETRÔNICA GZERO',
    descricaoOS: 'LAB ELETRÔNICO INTERNO',
    // Usuário "Laboratório Eletrônico" (elet.gzero). AUVO_USER_ELETRONICA no .env, se definido, tem prioridade.
    auvo: {
      userId: process.env.AUVO_USER_ELETRONICA ? Number(process.env.AUVO_USER_ELETRONICA) : 249223,
      tipoDesmontagemId: 253514, // Desmontagem (Eletrônica)
      tipoMontagemId: 253515, // Montagem (Eletrônica)
    },
  },
  outros: {
    label: 'Outros',
    trelloLabel: null,
    auvo: null,
  },
};

module.exports = { CATEGORIAS, STATUS_EM_ANDAMENTO };
