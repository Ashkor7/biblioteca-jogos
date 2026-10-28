
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

export default function App() {
  const [jogos, setJogos] = useState(() => {
    return JSON.parse(localStorage.getItem("jogos")) || [];
  });

  const [form, setForm] = useState({
    nome: "",
    categoria: "",
    plataforma: "",
    preco: "",
    status: "Não iniciado",
    capa: "",
    avaliacao: ""
  });

  const [pesquisa, setPesquisa] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    localStorage.setItem("jogos", JSON.stringify(jogos));
  }, [jogos]);

  function alterar(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function carregarCapa(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = () => {
      setForm({ ...form, capa: leitor.result });
    };
    leitor.readAsDataURL(arquivo);
  }

  function salvar(e) {
    e.preventDefault();

    if (!form.nome || !form.categoria || !form.plataforma || form.preco === "") {
      return;
    }

    const jogo = {
      ...form,
      id: editando ?? Date.now(),
      preco: Number(form.preco),
      avaliacao: form.status === "Não iniciado" ? "" : form.avaliacao,
      destaque: editando === null ? false : Boolean(form.destaque)
    };

    if (editando !== null) {
      setJogos(jogos.map(j => j.id === editando ? jogo : j));
    } else {
      setJogos([...jogos, jogo]);
    }

    cancelar();
  }

  function cancelar() {
    setForm({
      nome: "",
      categoria: "",
      plataforma: "",
      preco: "",
      status: "Não iniciado",
      capa: "",
      avaliacao: ""
    });
    setEditando(null);
  }

  function editar(jogo) {
    setForm(jogo);
    setEditando(jogo.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(id) {
    const resultado = await Swal.fire({
      title: "Alerta ❗",
      text: "Deseja excluir este jogo?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Excluir",
      cancelButtonText: "Cancelar",
      reverseButtons: true
    });

    if (resultado.isConfirmed) {
      setJogos(jogos.filter(j => j.id !== id));
      if (editando === id) cancelar();
    }
  }

  function destacar(id) {
    const removendoDestaque = jogos.some(jogo => jogo.id === id && jogo.destaque);

    setJogos(jogos.map(jogo => ({
      ...jogo,
      destaque: !removendoDestaque && jogo.id === id
    })));
  }

  const jogosFiltrados = jogos
    .filter(j => {
    const texto = `${j.nome} ${j.categoria} ${j.plataforma} ${j.status}`.toLowerCase();
    return texto.includes(pesquisa.toLowerCase()) &&
      (filtro === "Todos" || j.status === filtro);
    })
    .sort((a, b) => Number(Boolean(b.destaque)) - Number(Boolean(a.destaque)));

  const total = jogos.length;
  const valorTotal = jogos.reduce((soma, j) => soma + Number(j.preco), 0);
  const zerados = jogos.filter(j => j.status === "Zerado").length;

  function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  const campo = "w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-blue-500";
  const botao = "rounded-lg px-4 py-2 font-medium transition";

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">

        <header className="mb-8 flex flex-col items-center text-center">
          <img
            src="/Biblioteca de Jogos Gamer.png"
            alt="Biblioteca de Jogos"
            className="mb-4 h-auto max-h-32 w-full max-w-2xl object-contain"
          />
          <p className="mt-2 text-slate-400">
            Gerencie sua coleção de jogos
          </p>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-800 p-5 text-center">
            <p className="text-slate-400">Total de jogos</p>
            <h2 className="text-3xl font-bold">{total}</h2>
          </div>

          <div className="rounded-xl bg-slate-800 p-5 text-center">
            <p className="text-slate-400">Jogos zerados</p>
            <h2 className="text-3xl font-bold text-green-400">
              {zerados}
            </h2>
          </div>

          <div className="rounded-xl bg-slate-800 p-5 text-center">
            <p className="text-slate-400">Valor da biblioteca</p>
            <h2 className="text-2xl font-bold text-blue-400">
              {moeda(valorTotal)}
            </h2>
          </div>
        </div>

        <form onSubmit={salvar} className="mb-8 rounded-xl bg-slate-800 p-6">
          <h2 className="mb-5 text-xl font-bold">
            {editando !== null ? "Editar jogo" : "Adicionar jogo"}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              className={campo}
              name="nome"
              placeholder="Nome do jogo"
              value={form.nome}
              onChange={alterar}
              required
            />

            <select
              className={campo}
              name="categoria"
              value={form.categoria}
              onChange={alterar}
              required
            >
              <option value="">Selecione a categoria</option>
              <option>Ação</option>
              <option>Aventura</option>
              <option>RPG</option>
              <option>Corrida</option>
              <option>Esporte</option>
              <option>Estratégia</option>
              <option>Terror</option>
              <option>Simulação</option>
              <option>Outro</option>
            </select>

            <select
              className={campo}
              name="plataforma"
              value={form.plataforma}
              onChange={alterar}
              required
            >
              <option value="">Selecione a plataforma</option>
              <option>PC</option>
              <option>PlayStation</option>
              <option>Xbox</option>
              <option>Nintendo Switch</option>
              <option>Mobile</option>
              <option>Outro</option>
            </select>

            <input
              className={campo}
              name="preco"
              type="number"
              min="0"
              step="0.01"
              placeholder="Preço (R$)"
              value={form.preco}
              onChange={alterar}
              required
            />

            <select
              className={campo}
              name="status"
              value={form.status}
              onChange={alterar}
            >
              <option>Não iniciado</option>
              <option>Zerado</option>
              <option>Abandonado</option>
            </select>

            {form.status !== "Não iniciado" && (
              <select
                className={campo}
                name="avaliacao"
                value={form.avaliacao}
                onChange={alterar}
                required
              >
                <option value="">Avaliação do jogo</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "estrela" : "estrelas"}
                  </option>
                ))}
              </select>
            )}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-400">
                Imagem de capa
              </label>
              <input
                className={campo}
                type="file"
                accept="image/*"
                onChange={carregarCapa}
              />

              {form.capa && (
                <img
                  src={form.capa}
                  alt="Prévia da capa"
                  className="mt-3 h-40 w-28 rounded-lg object-cover"
                />
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              className={`${botao} bg-blue-600 hover:bg-blue-700`}
              type="submit"
            >
              {editando !== null ? "Salvar alterações" : "Adicionar jogo"}
            </button>

            {editando !== null && (
              <button
                className={`${botao} bg-slate-600 hover:bg-slate-500`}
                type="button"
                onClick={cancelar}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            className={campo}
            placeholder="Pesquisar por nome, categoria ou plataforma..."
            value={pesquisa}
            onChange={e => setPesquisa(e.target.value)}
          />

          <select
            className={campo}
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          >
            <option>Todos</option>
            <option>Não iniciado</option>
            <option>Zerado</option>
            <option>Abandonado</option>
          </select>
        </div>

        {jogosFiltrados.length === 0 ? (
          <p className="rounded-xl bg-slate-800 p-8 text-center text-slate-400">
            Nenhum jogo encontrado.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {jogosFiltrados.map(jogo => (
              <div
                key={jogo.id}
                className="overflow-hidden rounded-xl bg-slate-800"
              >
                {jogo.destaque && (
                  <div className="bg-blue-600 px-4 py-2 text-center text-sm font-bold text-white">
                    Registro em destaque
                  </div>
                )}

                {jogo.capa ? (
                  <img
                    src={jogo.capa}
                    alt={jogo.nome}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-slate-700 text-slate-400">
                    Sem capa
                  </div>
                )}

                <div className="p-4">
                  <h3 className="mb-2 text-lg font-bold">
                    {jogo.nome}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {jogo.categoria} • {jogo.plataforma}
                  </p>

                  <p className="mt-2 font-semibold text-blue-400">
                    {moeda(jogo.preco)}
                  </p>

                  <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    jogo.status === "Zerado"
                      ? "bg-green-900 text-green-300"
                      : jogo.status === "Abandonado"
                      ? "bg-red-900 text-red-300"
                      : "bg-slate-600 text-slate-200"
                  }`}>
                    {jogo.status}
                  </span>

                  {jogo.status !== "Não iniciado" && jogo.avaliacao && (
                    <p className="mt-3 text-yellow-400">
                      {"★".repeat(Number(jogo.avaliacao))}
                      {"☆".repeat(5 - Number(jogo.avaliacao))}
                    </p>
                  )}

                  <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      className={`${botao} min-w-0 whitespace-normal text-sm leading-tight ${
                        jogo.destaque
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-slate-600 hover:bg-slate-500"
                      }`}
                      onClick={() => destacar(jogo.id)}
                      aria-label={jogo.destaque
                        ? `Remover destaque de ${jogo.nome}`
                        : `Destacar ${jogo.nome}`}
                    >
                      {jogo.destaque ? "Remover destaque" : "Destacar registro"}
                    </button>

                    <button
                      type="button"
                      className={`${botao} bg-blue-600 hover:bg-blue-700`}
                      onClick={() => editar(jogo)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={`${botao} bg-red-600 hover:bg-red-700`}
                      onClick={() => excluir(jogo.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
