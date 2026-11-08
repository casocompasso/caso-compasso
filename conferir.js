// Conferência da urna, do Caso compasso (urnasbr.com). Roda só no navegador: a pessoa solta o registro de uma urna
// (-log.jez, baixado do TSE) e, se quiser, a assinatura dela (-vota.vsc). O programa calcula o código SHA-512 do arquivo,
// procura esse código na assinatura, abre o registro (logd.dat) e refaz a conta do dia da eleição: sequências de 2 votos
// ou mais seguidos com o mesmo tempo, cada voto medido desde o voto gravado anterior. Nada sai do computador da pessoa.
// Origem: urnasbr.com — Caso compasso. Licença MIT (arquivo LICENSE).
"use strict";

const COMPUTADO = "O voto do eleitor foi computado";
const TURNOS = { "04/10/2026": "1º turno", "25/10/2026": "2º turno" };
const CODIGO_TURNO = { 3220: "1t", 3221: "2t" };  // no nome do arquivo do TSE
const fmt = (n) => n.toLocaleString("pt-BR");
const segundos = (h) => { const [a, b, c] = h.split(":").map(Number); return a * 3600 + b * 60 + c; };
const hexa = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const kb = (n) => `${fmt(Math.round(n / 1024))} KB`;
// número de título de mesário (e qualquer número longo) não vai para a tela
const esconder = (t) => t.replace(/\d{8,}/g, "(número escondido)");

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return e;
}

// o .jez é um ZIP: acha o logd.dat pelo índice do fim do arquivo e abre com o que o navegador já tem
async function abrirJez(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let fim = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error("o arquivo não é um ZIP (.jez) inteiro");
  let p = v.getUint32(fim + 16, true);
  for (let n = v.getUint16(fim + 10, true); n > 0; n--) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true), tam = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true);
    const ex = v.getUint16(p + 30, true), cm = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    if (nome === "logd.dat") {
      const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const dados = u8.subarray(ini, ini + tam);
      if (metodo === 0) return dados;
      if (metodo !== 8) throw new Error(`o logd.dat está comprimido de um jeito que o navegador não abre (método ${metodo})`);
      return new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    }
    p += 46 + nl + ex + cm;
  }
  throw new Error("não há logd.dat dentro do arquivo");
}

// o dia da eleição a conferir. A urna que votou nos dois turnos leva o registro do 1º turno junto no do 2º, então vale o
// turno do nome do arquivo; sem ele, o turno mais recente que está no registro; sem turno de 2026, o dia com mais votos
function diaDosVotos(linhas, turno) {
  const conta = new Map();
  for (const c of linhas) if (c[4] === COMPUTADO) conta.set(c[0].slice(0, 10), (conta.get(c[0].slice(0, 10)) || 0) + 1);
  const doNome = Object.keys(TURNOS).find((d) => TURNOS[d].startsWith(turno === "1t" ? "1º" : turno === "2t" ? "2º" : "-"));
  if (doNome && conta.has(doNome)) return doNome;
  const eleicoes = Object.keys(TURNOS).filter((d) => conta.has(d));
  if (eleicoes.length) return eleicoes[eleicoes.length - 1];
  return [...conta.keys()].sort((a, b) => conta.get(b) - conta.get(a))[0];
}

// sequências de votos seguidos com o mesmo tempo, a mesma conta de urnasbr.com
function refazer(texto, turno) {
  const linhas = texto.split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));
  const dia = diaDosVotos(linhas, turno);
  const votos = [];
  linhas.forEach((c, i) => { if (c[4] === COMPUTADO && c[0].startsWith(dia)) votos.push({ h: c[0].slice(11), i }); });
  const tempos = votos.slice(1).map((x, k) => ({ ...x, s: segundos(x.h) - segundos(votos[k].h) }));
  const seqs = [];
  for (let i = 0; i < tempos.length; ) {
    let j = i;
    while (j + 1 < tempos.length && tempos[j + 1].s === tempos[i].s) j++;
    if (j > i) seqs.push({ de: tempos[i].h, ate: tempos[j].h, votos: j - i + 1, s: tempos[i].s, k: i });
    i = j + 1;
  }
  const urna = (linhas.find((c) => /^\d{8}$/.test(c[2])) || [])[2];
  return { linhas, dia, votos, tempos, seqs, urna };
}

// o03221df9701200100257-log.jez -> 2º turno, DF, município 97012, zona 10, seção 257
function deQualUrna(nome) {
  const m = nome.match(/^o0(\d{4})([a-z]{2})(\d{5})(\d{4})(\d{4})-log\.jez$/i);
  if (!m) return null;
  return { turno: CODIGO_TURNO[m[1]], uf: m[2].toLowerCase(), cod: +m[3], zona: +m[4], secao: +m[5] };
}

function montar(caixa) {
  const passos = el("ol", { class: "cf-passos", hidden: true });
  const saida = el("div", {});
  const entrada = el("input", { type: "file", accept: ".jez,.dat,.vsc", multiple: true, id: "cf-arquivo" });
  const soltar = el("label", { class: "cf-soltar", for: "cf-arquivo" },
    el("b", {}, "Solte aqui o arquivo da urna"), " (o que termina em -log.jez, ou o logd.dat de dentro dele), ou clique para escolher. Ele é lido só neste computador.", entrada);
  caixa.replaceChildren(el("h2", {}, "Conferir um arquivo"), soltar, passos, saida);

  let atual = null;
  const passo = (t) => { atual = el("li", {}, t); passos.append(atual); return atual; };
  const feito = (t, extra, classe = "ok") => { atual.className = classe; atual.replaceChildren(t, extra ? el("span", { class: "codigo" }, extra) : ""); };
  const parar = (e) => { if (!atual) passo(""); atual.className = "erro"; atual.textContent = `Não deu para conferir: ${e.message}.`; };

  // o arquivo de assinatura da urna (vota.vsc) lista o código SHA-512 de cada arquivo dela
  async function conferirAssinatura(buf, vsc) {
    passo(`Procurando o código no arquivo de assinatura (${vsc.name})…`);
    const codigo = [...new Uint8Array(await crypto.subtle.digest("SHA-512", buf))];
    const assin = new Uint8Array(await vsc.arrayBuffer());
    let achou = false;
    for (let i = 0; i <= assin.length - 64 && !achou; i++) achou = codigo.every((b, j) => assin[i + j] === b);
    if (!achou) throw new Error("o código do registro não está nesse arquivo de assinatura");
    feito(`O mesmo código está no arquivo de assinatura da urna (${vsc.name})`);
  }

  async function doArquivo(arquivos) {
    const vsc = arquivos.find((x) => /\.vsc$/i.test(x.name)), f = arquivos.find((x) => x !== vsc);
    if (!f) throw new Error("solte também o arquivo que termina em -log.jez; a assinatura sozinha não traz os votos");
    passo(`Lendo ${f.name}…`);
    // o registro de uma urna tem centenas de KB; o pacote do estado tem gigabytes e travaria o navegador
    if (f.size > 50 * 2 ** 20) throw new Error(`este arquivo tem ${fmt(Math.round(f.size / 2 ** 20))} MB, é o pacote de muitas urnas. Abra o pacote e solte só o arquivo -log.jez da urna`);
    const buf = await f.arrayBuffer(), u8 = new Uint8Array(buf);
    feito(`Arquivo lido neste computador: ${f.name}, ${kb(buf.byteLength)}`);
    const zip = u8[0] === 0x50 && u8[1] === 0x4b;
    let registro = u8;
    if (zip) {
      registro = await abrirJez(buf);
      passo("Calculando o código do arquivo (SHA-512)…");
      feito("Código do arquivo (SHA-512). Compare com o da ficha da urna em urnasbr.com:", hexa(await crypto.subtle.digest("SHA-512", buf)));
      if (vsc) await conferirAssinatura(buf, vsc);
    } else {
      passo("");
      feito("Este é o logd.dat já aberto. O código SHA-512 da ficha é do arquivo .jez inteiro, então essa parte fica de fora; a conta é refeita no logd.dat.", null, "difere");
    }
    conta(registro, deQualUrna(f.name.replace(/\s*\(\d+\)(?=\.\w+$)/, "")));  // " (1)": o navegador baixou de novo
  }

  function conta(bytes, qual) {
    passo("Abrindo o registro e refazendo a conta…");
    const r = refazer(new TextDecoder("latin1").decode(bytes), qual && qual.turno);
    if (!r.votos.length) throw new Error("não há votos computados neste arquivo; ele não é o registro de uma urna no dia da eleição");
    const turno = TURNOS[r.dia] ? ` (${TURNOS[r.dia]})` : "";
    feito(`Registro aberto: urna ${r.urna || "sem número"}, ${fmt(r.votos.length)} votos gravados no dia ${r.dia}${turno}, ${fmt(r.tempos.length)} tempos entre um voto e o seguinte`);
    const nasSeqs = r.seqs.reduce((t, q) => t + q.votos, 0);
    passo("");
    feito(r.seqs.length
      ? `Conta refeita: ${fmt(r.seqs.length)} sequências de 2 votos ou mais seguidos com o mesmo tempo, somando ${fmt(nasSeqs)} votos; a maior tem ${Math.max(...r.seqs.map((q) => q.votos))} votos`
      : "Conta refeita: nenhum par de votos seguidos teve o mesmo tempo");
    const ficha = qual && qual.turno && `https://urnasbr.com/urna/${qual.uf}/${qual.cod}/${qual.zona}/${qual.secao}/${qual.turno}`;
    saida.replaceChildren(
      ficha ? el("p", { class: "cf-ficha" }, "Compare com a ficha desta urna: ", el("a", { href: ficha, rel: "noreferrer" }, ficha.replace("https://", ""))) : "",
      tabelaSeqs(r), trecho(r));
  }

  function tabelaSeqs(r) {
    if (!r.seqs.length) return "";
    const linhas = [...r.seqs].sort((a, b) => b.votos - a.votos || segundos(a.de) - segundos(b.de));
    return el("div", { class: "tabela-rolagem" }, el("table", { class: "cartoes" },
      el("caption", {}, "As sequências do dia, da maior para a menor"),
      el("thead", {}, el("tr", {}, el("th", { class: "n" }, "Votos seguidos"), el("th", { class: "n" }, "Tempo de cada"),
        el("th", {}, "Primeiro voto"), el("th", {}, "Último voto"))),
      el("tbody", {}, linhas.map((q) => el("tr", { class: q.votos >= 5 ? "forte" : null },
        el("td", { class: "n", "data-rotulo": "Votos seguidos" }, q.votos), el("td", { class: "n", "data-rotulo": "Tempo de cada" }, `${q.s} s`),
        el("td", { "data-rotulo": "Primeiro voto" }, q.de), el("td", { "data-rotulo": "Último voto" }, q.ate))))));
  }

  // cada sequência na ordem do relógio, com as linhas do arquivo como a urna escreveu: do voto de partida (de onde sai o
  // primeiro tempo) até o último voto dela; os eleitores se alternam em dois tons e cada voto diz o seu número
  const ABERTAS = 3;
  function trecho(r) {
    if (!r.seqs.length) return "";
    const ordem = [...r.seqs].sort((a, b) => a.k - b.k);
    const bloco = el("div", { class: "cf-trechos" }, el("h3", {}, "O arquivo do TSE, linha a linha, em cada sequência"));
    ordem.forEach((q, n) => {
      const partida = r.votos[q.k].i, fim = r.tempos[q.k + q.votos - 1].i;  // tempos[k] é o voto votos[k + 1]
      const numero = new Map();
      for (let k = 0; k < q.votos; k++) numero.set(r.tempos[q.k + k].i, k + 1);
      let eleitor = 0;
      const linhas = r.linhas.slice(partida, fim + 1).map((c, j) => {
        const i = partida + j, v = numero.get(i);
        const tr = el("tr", { class: `${eleitor % 2 ? "par" : ""}${i === partida ? " partida" : ""}${v ? " voto" : ""}` },
          el("td", { class: "h" }, c[0].slice(11)), el("td", {}, esconder(c[4] || "")), el("td", { class: "cod" }, c[5] || ""),
          el("td", { class: "conta" }, i === partida ? "ponto de partida" : v ? `${v}º voto · ${q.s} s` : ""));
        if (c[4] === COMPUTADO) eleitor++;
        return tr;
      });
      const tabela = el("div", { class: "tabela-rolagem" }, el("table", { class: "registro" },
        el("thead", {}, el("tr", {}, el("th", {}, "Hora"), el("th", {}, "Linha do arquivo"), el("th", { class: "cod" }, "Código da linha"),
          el("th", { class: "conta" }, "Desde o voto anterior"))),
        el("tbody", {}, linhas)));
      bloco.append(el("details", { open: n < ABERTAS || null },
        el("summary", {}, `${n + 1}ª sequência: ${q.votos} votos seguidos com ${q.s} s cada, das ${q.de} às ${q.ate}`), tabela));
    });
    bloco.append(el("p", { class: "nota" }, "O ponto de partida é o voto de onde sai o primeiro tempo. As linhas estão como a urna escreveu. Números de título de mesário aparecem como “(número escondido)”."));
    return bloco;
  }

  const usar = (fs) => {
    if (!fs.length) return;
    passos.hidden = false; passos.replaceChildren(); saida.replaceChildren(); atual = null;
    doArquivo(fs).catch(parar).finally(() => { entrada.value = ""; });
  };
  entrada.addEventListener("change", () => usar([...entrada.files]));
  soltar.addEventListener("dragover", (e) => { e.preventDefault(); soltar.classList.add("em-cima"); });
  soltar.addEventListener("dragleave", () => soltar.classList.remove("em-cima"));
  soltar.addEventListener("drop", (e) => { e.preventDefault(); soltar.classList.remove("em-cima"); usar([...e.dataTransfer.files]); });
}

montar(document.getElementById("conferir"));
