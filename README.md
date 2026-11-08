# Conferência da urna — Caso compasso

**Origem: [urnasbr.com](https://urnasbr.com) — Caso compasso.**

Uma página que roda só no seu computador e confere o registro interno de uma urna das eleições de 2026, baixado do
site do TSE (Tribunal Superior Eleitoral). Ela faz três coisas:

1. **Calcula o código SHA-512 do arquivo.** É a impressão digital dele: se um único byte mudar, o código muda. Compare
   com o código da ficha da urna em urnasbr.com.
2. **Confere a assinatura da urna.** Se você soltar junto o arquivo de assinatura (`-vota.vsc`), a página procura nele
   o mesmo código. A própria urna gravou essa lista no dia da eleição.
3. **Refaz a conta do dia inteiro.** Abre o registro, pega a hora de cada voto computado e mostra as sequências:
   2 votos ou mais seguidos com exatamente o mesmo tempo entre eles. Cada sequência aparece linha a linha, como a urna
   escreveu.

Nada sai do seu computador. A página não manda o arquivo para lugar nenhum e não pede nada à internet.

## O caso compasso, em votos

Votos que vieram em sequência, nos dois turnos de 2026, contados em todas as urnas do pacote oficial do TSE. Há duas
formas de medir o tempo de cada eleitor: do voto gravado até o próximo voto gravado (voto a voto) e do título
digitado até o próximo título digitado (título a título). Cada voto entra numa conta só, então as duas somam.

| Turno | Urnas no arquivo do TSE | Voto a voto | Título a título | Os dois somados |
|---|---:|---:|---:|---:|
| 1º turno, 4 de outubro de 2026 | 499.176 | 2.307.975 | 2.158.991 | **4.466.966** |
| 2º turno, 25 de outubro de 2026 | 499.177 | 2.674.153 | 2.509.808 | **5.183.961** |

Contagem de urnasbr.com em 29 de outubro de 2026. A comparação de cada urna com a coincidência, urna por urna e no
país, está em [urnasbr.com](https://urnasbr.com).

## Como usar

1. **Baixe esta página.** Botão verde *Code* → *Download ZIP*, e descompacte. Ou use
   [urnasbr.com/conferencia](https://urnasbr.com/conferencia/), que faz a mesma conta.
2. **Abra o `index.html`** no navegador (Chrome, Edge, Firefox ou Safari atuais). Não precisa instalar nada.
3. **Baixe o arquivo da urna no TSE.** A ficha de cada urna em [urnasbr.com](https://urnasbr.com/conferencia/) tem o
   link. Ou baixe o pacote do estado inteiro:

   ```
   https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/arqurnatot/bu_imgbu_logjez_rdv_vscmr_2026_2t_DF.zip
   ```

   Troque `2t` por `1t` para o 1º turno e `DF` pela sigla do estado (`ZZ` é o exterior). Dentro do pacote, o registro
   de cada urna é o arquivo que termina em `-log.jez`; a assinatura é o de mesmo nome que termina em `-vota.vsc`.
4. **Solte o arquivo na página.** O nome do arquivo diz qual é a urna: `o03221df9701200100257-log.jez` é o
   2º turno (`3221`; o 1º é `3220`), Distrito Federal (`df`), município `97012`, zona `0010`, seção `0257`.

## Como a conta é feita

- Do registro (`logd.dat`, dentro do `.jez`) só entram as linhas *"O voto do eleitor foi computado"* do dia da eleição.
- O tempo de cada voto é a diferença, em segundos, entre a hora dele e a do voto computado anterior.
- Uma sequência é um trecho de votos seguidos com o mesmo tempo. "3 votos seguidos com 41 s cada" quer dizer três
  votos, cada um gravado 41 segundos depois do anterior.
- Números de título de mesário que aparecem no registro são escondidos na tela.

O código está todo em [`conferir.js`](conferir.js), sem bibliotecas de fora.

## Pode usar

Pode copiar, mudar e pôr em qualquer site ou programa, desde que cite a origem: **urnasbr.com — Caso compasso**.
O código é MIT e o texto é CC BY 4.0; os dois pedem o crédito (arquivo [LICENSE](LICENSE)).

Site independente: não é do governo nem do TSE. Os dados são os oficiais do TSE. Contato:
[contato@urnasbr.com](mailto:contato@urnasbr.com).
