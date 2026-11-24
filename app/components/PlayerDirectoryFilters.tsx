import {
  PLAYER_POSITION_FILTER_OPTIONS,
  PLAYER_TYPE_FILTER_OPTIONS,
  type PlayerDirectoryFilters as Filters,
} from "../../lib/player-directory-filters";

export function PlayerDirectoryFilters({
  filters,
  onChange,
  idPrefix,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  idPrefix: string;
}) {
  const active = Boolean(filters.name || filters.position || filters.type);
  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });

  return <div className="player-directory-filters" aria-label="Filtros de jogadores">
    <label htmlFor={`${idPrefix}-player-name`}><span>Nome</span><input id={`${idPrefix}-player-name`} type="search" value={filters.name} onChange={event => set("name", event.target.value)} placeholder="Nome ou apelido…"/></label>
    <label htmlFor={`${idPrefix}-player-position`}><span>Posição</span><select id={`${idPrefix}-player-position`} value={filters.position} onChange={event => set("position", event.target.value)}><option value="">Todas as posições</option>{PLAYER_POSITION_FILTER_OPTIONS.map(position => <option value={position} key={position}>{position}</option>)}</select></label>
    <label htmlFor={`${idPrefix}-player-type`}><span>Tipo</span><select id={`${idPrefix}-player-type`} value={filters.type} onChange={event => set("type", event.target.value)}><option value="">Todos os tipos</option>{PLAYER_TYPE_FILTER_OPTIONS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
    {active && <button type="button" className="player-filter-clear" onClick={() => onChange({ name: "", position: "", type: "" })}>Limpar filtros</button>}
  </div>;
}
