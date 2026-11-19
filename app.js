let todosTarifarios = [];
let tabAtiva = 'CASA';

async function iniciar() {
  try {
    const resposta = await fetch('./tarifarios.json');
    if (!resposta.ok) {
      throw new Error('Erro HTTP: ' + resposta.status);
    }
    todosTarifarios = await resposta.json();
    configurarTabs();
    atualizarVista();
  } catch (erro) {
    document.getElementById('contador-resultados').innerHTML =
      'Não foi possível carregar o ficheiro tarifarios.json.';
    console.error('Detalhe do erro:', erro);
  }
}

function configurarTabs() {
  const botoes = document.querySelectorAll('.tab-btn');
  const titulo = document.getElementById('titulo-pagina');
  const campoFibra = document.getElementById('campo-fibra');
  const campoTv = document.getElementById('campo-tv');

  botoes.forEach(btn => {
    btn.addEventListener('click', () => {
      botoes.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabAtiva = btn.dataset.tab;

      if (tabAtiva === 'MOVEL') {
        titulo.textContent = 'Simulador de Tarifários Móveis (Cartões SIM)';
        campoFibra.classList.add('oculto');
        campoTv.classList.add('oculto');
        document.getElementById('filtro-fibra').value = '0';
        document.getElementById('filtro-tv').value = 'TODOS';
      } else if (tabAtiva === 'CASA') {
        titulo.textContent = 'Simulador de Pacotes Casa (Fibra, TV e Móvel)';
        campoFibra.classList.remove('oculto');
        campoTv.classList.remove('oculto');
      } else {
        titulo.textContent = 'Todos os Tarifários de Telecomunicações';
        campoFibra.classList.remove('oculto');
        campoTv.classList.remove('oculto');
      }

      atualizarVista();
    });
  });
}

function calcularCusto24Meses(t) {
  const periodo = 24;
  const mesesPromo = Math.min(t.meses_promo, periodo);
  const mesesNormais = periodo - mesesPromo;

  const custoMensalidades = (mesesPromo * t.mensalidade_promo) + (mesesNormais * t.mensalidade_base);
  const custoTotal = custoMensalidades + t.custo_instalacao - t.oferta_voucher;
  const mediaMensal = custoTotal / periodo;

  return { total24m: custoTotal, mediaMensal: mediaMensal };
}

function atualizarVista() {
  const operadora = document.getElementById('filtro-operadora').value;
  const fibraMin = Number(document.getElementById('filtro-fibra').value);
  const dadosMin = Number(document.getElementById('filtro-dados').value);
  const fidMax = Number(document.getElementById('filtro-fidelizacao').value);
  const tvFiltro = document.getElementById('filtro-tv').value;

  const resultados = todosTarifarios
    .filter(t => tabAtiva === 'TODOS' || t.categoria === tabAtiva)
    .filter(t => operadora === 'TODAS' || t.operadora === operadora)
    .filter(t => t.fibra_mbps >= fibraMin)
    .filter(t => t.dados_gb >= dadosMin)
    .filter(t => t.fidelizacao_meses <= fidMax)
    .filter(t => {
      if (tvFiltro === 'COM_TV') return t.tv_canais > 0;
      if (tvFiltro === 'SEM_TV') return t.tv_canais === 0;
      return true;
    })
    .map(t => ({ ...t, calculo: calcularCusto24Meses(t) }))
    .sort((a, b) => a.calculo.mediaMensal - b.calculo.mediaMensal);

  const container = document.getElementById('lista-resultados');
  const contador = document.getElementById('contador-resultados');
  container.innerHTML = '';

  contador.textContent = resultados.length + ' tarifários encontrados (ordenados pelo menor custo real)';

  if (resultados.length === 0) {
    container.innerHTML = '<div style="background:#fff;padding:30px;border-radius:12px;text-align:center;color:#64748b;">Nenhum tarifário corresponde aos filtros escolhidos.</div>';
    return;
  }

  resultados.forEach((item, index) => {
    const isPrimeiro = index === 0;
    const card = document.createElement('article');
    card.className = 'cartao-pacote ' + (isPrimeiro ? 'melhor-opcao' : '');

    const opsConhecidas = ['DIGI', 'WOO', 'MEO', 'Vodafone', 'NOS', 'Amigo', 'Uzo'];
    const classeOp = opsConhecidas.includes(item.operadora) ? 'op-' + item.operadora : 'op-default';

    const textoPromo = item.meses_promo > 0
      ? item.mensalidade_promo.toFixed(2) + '€ nos 1.ºs ' + item.meses_promo + ' meses, depois ' + item.mensalidade_base.toFixed(2) + '€'
      : 'Mensalidade fixa de ' + item.mensalidade_base.toFixed(2) + '€';

    const textoVoucher = item.oferta_voucher > 0
      ? '<br>Inclui oferta/voucher (-' + item.oferta_voucher + '€)'
      : '';

    const specsHtml = item.categoria === 'MOVEL'
      ? '<span class="spec-pill">' + item.dados_gb + ' GB Dados Móveis</span>' +
        '<span class="spec-pill">Chamadas e SMS incluídos</span>' +
        '<span class="spec-pill">Fidelização: ' + (item.fidelizacao_meses === 0 ? 'Sem fidelização' : item.fidelizacao_meses + 'm') + '</span>'
      : '<span class="spec-pill">Fibra ' + item.fibra_mbps + ' Mbps</span>' +
        '<span class="spec-pill">' + (item.tv_canais > 0 ? item.tv_canais + ' Canais TV' : 'Sem TV') + '</span>' +
        '<span class="spec-pill">' + item.cartoes_moveis + ' Cartão (' + item.dados_gb + ' GB)</span>' +
        '<span class="spec-pill">Fidelização: ' + item.fidelizacao_meses + 'm</span>';

    card.innerHTML =
      (isPrimeiro ? '<div class="selo-vencedor">Melhor Preço Real</div>' : '') +
      '<div>' +
        '<span class="op-badge ' + classeOp + '">' + item.operadora + '</span>' +
        '<h2 class="pacote-titulo">' + item.nome + '</h2>' +
        '<div class="pacote-tipo">' + item.tipo + '</div>' +
      '</div>' +
      '<div class="specs">' + specsHtml + '</div>' +
      '<div class="preco-box">' +
        '<div class="preco-label">' + (item.categoria === 'MOVEL' ? 'Mensalidade Real' : 'Custo Médio Real') + '</div>' +
        '<div class="preco-real">' + item.calculo.mediaMensal.toFixed(2) + '€<span>/mês</span></div>' +
        '<div class="preco-detalhes">' + textoPromo + textoVoucher + '</div>' +
        '<div class="total-24m">Total a 24 meses: ' + item.calculo.total24m.toFixed(2) + '€</div>' +
      '</div>';

    container.appendChild(card);
  });
}

document.querySelectorAll('select').forEach(sel => sel.addEventListener('change', atualizarVista));

document.getElementById('btn-limpar').addEventListener('click', () => {
  document.getElementById('filtro-operadora').value = 'TODAS';
  document.getElementById('filtro-fibra').value = '0';
  document.getElementById('filtro-dados').value = '0';
  document.getElementById('filtro-fidelizacao').value = '24';
  document.getElementById('filtro-tv').value = 'TODOS';
  atualizarVista();
});

iniciar();
