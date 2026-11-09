import { useState } from 'react';
import { FiClock } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useGames, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import Modal, { ModalActions } from './Modal.jsx';
import { Field } from './Field.jsx';
import { LIMITS, todayIn, addDays } from '../../shared/domain.js';

const pad = (n) => String(n).padStart(2, '0');
const timeOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "2026-11-09" + "22:30" no fuso do navegador → ISO. Fim antes do início = passou da meia-noite. */
function toInstant(day, time, after) {
  if (!time) return null;
  let date = new Date(`${day}T${time}`);
  if (after && date <= after) date = new Date(`${addDays(day, 1)}T${time}`);
  return date;
}

function initialForm(session, gameId) {
  if (session) {
    return {
      gameId: session.gameId,
      playedOn: session.playedOn,
      hours: String(Math.floor(session.durationMinutes / 60)),
      minutes: String(session.durationMinutes % 60),
      start: timeOf(session.startedAt),
      end: timeOf(session.endedAt),
      notes: session.notes ?? '',
    };
  }
  return { gameId: gameId ?? '', playedOn: todayIn(), hours: '', minutes: '', start: '', end: '', notes: '' };
}

/** Criar ou editar sessão do diário. A duração pode vir de horas+minutos ou de início/fim. */
export default function SessionDialog({ session = null, gameId = null, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(() => initialForm(session, gameId));
  const [errors, setErrors] = useState({});
  const games = useGames({ ownership: 'OWNED', sort: 'title', pageSize: 200 });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = useLibraryMutation(
    (payload) => (session ? api.updateSession(session.id, payload) : api.createSession(payload)),
    {
      onSuccess: () => {
        toast.success(session ? 'Sessão atualizada.' : 'Sessão registrada no diário.');
        onClose();
      },
      onError: (error) => {
        setErrors(error.fields ?? {});
        if (!error.fields || !Object.keys(error.fields).length) toast.error(error.message);
      },
    },
  );

  function submit(event) {
    event.preventDefault();
    const local = {};
    if (!form.gameId) local.gameId = 'Escolha o jogo';
    const h = form.hours.trim() === '' ? 0 : Number(form.hours);
    const m = form.minutes.trim() === '' ? 0 : Number(form.minutes);
    if (!Number.isInteger(h) || h < 0 || h > 24) local.durationMinutes = 'Horas inválidas';
    if (!Number.isInteger(m) || m < 0 || m > 59) local.durationMinutes = 'Minutos de 0 a 59';
    const startedAt = toInstant(form.playedOn, form.start);
    const endedAt = toInstant(form.playedOn, form.end, startedAt);
    if ((form.start && !form.end) || (!form.start && form.end)) local.endedAt = 'Informe o início e o fim, ou nenhum dos dois';
    const typed = h * 60 + m;
    if (!typed && !(startedAt && endedAt) && !local.durationMinutes) local.durationMinutes = 'Informe a duração ou o início e o fim';
    if (typed > LIMITS.sessionMaxMinutes) local.durationMinutes = 'Uma sessão pode ter no máximo 24 horas';
    setErrors(local);
    if (Object.keys(local).length) return;
    save.mutate({
      gameId: form.gameId,
      playedOn: form.playedOn,
      durationMinutes: typed || null,
      startedAt: startedAt?.toISOString() ?? null,
      endedAt: endedAt?.toISOString() ?? null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <Modal title={session ? 'Editar sessão' : 'Registrar sessão'} icon={FiClock} onClose={onClose} busy={save.isPending}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Jogo" error={errors.gameId}>
          {(a11y) => (
            <select {...a11y} className="input" value={form.gameId} onChange={set('gameId')}>
              <option value="">{games.isPending ? 'Carregando jogos…' : 'Escolha um jogo adquirido'}</option>
              {games.data?.items.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} — {g.platform.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Data" error={errors.playedOn}>
          {(a11y) => <input {...a11y} type="date" className="input" value={form.playedOn} max={todayIn()} onChange={set('playedOn')} required />}
        </Field>
        <fieldset className="border-0 p-0">
          <legend className="field-label">Duração</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted">Horas</span>
              <input className="input num" inputMode="numeric" value={form.hours} onChange={set('hours')} placeholder="2" aria-invalid={errors.durationMinutes ? 'true' : undefined} />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Minutos</span>
              <input className="input num" inputMode="numeric" value={form.minutes} onChange={set('minutes')} placeholder="30" aria-invalid={errors.durationMinutes ? 'true' : undefined} />
            </label>
          </div>
          {errors.durationMinutes && <p className="field-error">{errors.durationMinutes}</p>}
        </fieldset>
        <fieldset className="border-0 p-0">
          <legend className="field-label">Início e fim (opcional)</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted">Início</span>
              <input type="time" className="input num" value={form.start} onChange={set('start')} />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Fim</span>
              <input type="time" className="input num" value={form.end} onChange={set('end')} aria-invalid={errors.endedAt ? 'true' : undefined} />
            </label>
          </div>
          <p className="field-hint">Sem duração digitada, ela é calculada pelo intervalo.</p>
          {errors.endedAt && <p className="field-error">{errors.endedAt}</p>}
        </fieldset>
        <Field label="Observações" error={errors.notes} hint="Opcional. Ex.: concluí uma missão secundária.">
          {(a11y) => <textarea {...a11y} className="input" rows={3} value={form.notes} onChange={set('notes')} maxLength={LIMITS.sessionNotesMax} />}
        </Field>
        <ModalActions onCancel={onClose} busy={save.isPending} submitLabel={session ? 'Salvar sessão' : 'Registrar'} />
      </form>
    </Modal>
  );
}
