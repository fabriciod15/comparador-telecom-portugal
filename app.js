{\rtf1\ansi\ansicpg1252\cocoartf2908
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fmodern\fcharset0 Courier-Bold;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\b\fs28 \cf0 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 let todosTarifarios = [];\
\
// Carrega o ficheiro JSON assim que a p\'e1gina abre\
async function iniciar() \{\
  try \{\
    const resposta = await fetch('tarifarios.json');\
    todosTarifarios = await resposta.json();\
    atualizarTabela();\
  \} catch (erro) \{\
    console.error('Erro ao carregar tarif\'e1rios:', erro);\
  \}\
\}\
\
// F\'f3rmula transparente do custo total e m\'e9dio a 24 meses\
function calcularCusto24Meses(t) \{\
  const periodoAnalise = 24;\
  const mesesPromoEfetivos = Math.min(t.meses_promo, periodoAnalise);\
  const mesesNormais = periodoAnalise - mesesPromoEfetivos;\
\
  const custoMensalidades = (mesesPromoEfetivos * t.mensalidade_promo) + (mesesNormais * t.mensalidade_base);\
  const custoTotal = custoMensalidades + t.custo_instalacao - t.oferta_voucher;\
  const mediaMensalReal = custoTotal / periodoAnalise;\
\
  return \{\
    total24m: custoTotal,\
    mediaMensal: mediaMensalReal\
  \};\
\}\
\
function atualizarTabela() \{\
  const operadora = document.getElementById('filtro-operadora').value;\
  const fibraMin = Number(document.getElementById('filtro-fibra').value);\
  const fidMax = Number(document.getElementById('filtro-fidelizacao').value);\
  const tvFiltro = document.getElementById('filtro-tv').value;\
\
  // Filtra e calcula custos\
  const resultados = todosTarifarios\
    .filter(t => operadora === 'TODAS' || t.operadora === operadora)\
    .filter(t => t.fibra_mbps >= fibraMin)\
    .filter(t => t.fidelizacao_meses <= fidMax)\
    .filter(t => \{\
      if (tvFiltro === 'COM_TV') return t.tv_canais > 0;\
      if (tvFiltro === 'SEM_TV') return t.tv_canais === 0;\
      return true;\
    \})\
    .map(t => (\{ ...t, calculo: calcularCusto24Meses(t) \}))\
    // Ordena do mais barato para o mais caro no custo real\
    .sort((a, b) => a.calculo.mediaMensal - b.calculo.mediaMensal);\
\
  const tbody = document.getElementById('tabela-resultados');\
  tbody.innerHTML = '';\
\
  resultados.forEach(item => \{\
    const tr = document.createElement('tr');\
    const infoPromo = item.meses_promo > 0 \
      ? `$\{item.mensalidade_promo.toFixed(2)\}\'80 nos 1.\'bas $\{item.meses_promo\}m` \
      : 'Pre\'e7o fixo';\
    const infoVoucher = item.oferta_voucher > 0 \
      ? ` | Oferta voucher: -$\{item.oferta_voucher\}\'80` \
      : '';\
\
    tr.innerHTML = `\
      <td>\
        <span class="badge">$\{item.operadora\}</span><br>\
        <strong>$\{item.nome\}</strong>\
      </td>\
      <td>\
        Fibra $\{item.fibra_mbps\} Mbps \'95 $\{item.tv_canais > 0 ? item.tv_canais + ' canais' : 'Sem TV'\}<br>\
        <span class="detalhe">$\{item.cartoes_moveis\} cart\'e3o ($\{item.dados_gb\} GB)</span>\
      </td>\
      <td>$\{item.fidelizacao_meses\} meses</td>\
      <td>\
        $\{item.mensalidade_base.toFixed(2)\} \'80/m\'eas<br>\
        <span class="detalhe">$\{infoPromo\}$\{infoVoucher\}</span>\
      </td>\
      <td class="destaque">$\{item.calculo.mediaMensal.toFixed(2)\} \'80/m\'eas</td>\
      <td><strong>$\{item.calculo.total24m.toFixed(2)\} \'80</strong></td>\
    `;\
    tbody.appendChild(tr);\
  \});\
\}\
\
// Ouve altera\'e7\'f5es nos filtros\
document.querySelectorAll('select').forEach(select => \{\
  select.addEventListener('change', atualizarTabela);\
\});\
\
iniciar();\
}