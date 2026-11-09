import { useState } from 'react';
import { FiFolder } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import Modal, { ModalActions } from './Modal.jsx';
import Toggle from './Toggle.jsx';
import { Field } from './Field.jsx';
import { LIMITS } from '../../shared/domain.js';

/** Criar ou editar nome, descrição e visibilidade de uma coleção. */
export default function CollectionDialog({ collection = null, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: collection?.name ?? '',
    description: collection?.description ?? '',
    isPublic: collection?.isPublic ?? false,
  });
  const [errors, setErrors] = useState({});
  const save = useLibraryMutation(
    () => {
      const payload = { name: form.name, description: form.description || null, isPublic: form.isPublic };
      return collection ? api.updateCollection(collection.id, payload) : api.createCollection(payload);
    },
    {
      onSuccess: (saved) => {
        toast.success(collection ? 'Coleção atualizada.' : `Coleção “${saved.name}” criada.`);
        onSaved?.(saved);
        onClose();
      },
      onError: (error) => {
        setErrors(error.fields ?? {});
        if (!error.fields || !Object.keys(error.fields).length) toast.error(error.message);
      },
    },
  );
  return (
    <Modal title={collection ? 'Editar coleção' : 'Nova coleção'} icon={FiFolder} onClose={onClose} busy={save.isPending}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return setErrors({ name: 'Informe o nome da coleção' });
          save.mutate();
        }}
      >
        <Field label="Nome" error={errors.name} hint="Ex.: Jogos para zerar em 2027, Melhores histórias">
          {(a11y) => (
            <input {...a11y} className="input" value={form.name} maxLength={LIMITS.collectionNameMax} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          )}
        </Field>
        <Field label="Descrição" error={errors.description} hint="Opcional">
          {(a11y) => (
            <textarea
              {...a11y}
              className="input"
              rows={3}
              value={form.description}
              maxLength={LIMITS.collectionDescriptionMax}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          )}
        </Field>
        <Toggle
          label="Mostrar no perfil público"
          description="Só aparece para visitantes se o seu perfil também estiver público."
          checked={form.isPublic}
          onChange={(isPublic) => setForm((f) => ({ ...f, isPublic }))}
        />
        <ModalActions onCancel={onClose} busy={save.isPending} submitLabel={collection ? 'Salvar' : 'Criar coleção'} />
      </form>
    </Modal>
  );
}
