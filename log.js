document.addEventListener('DOMContentLoaded', () => {

    // Adicionado um check básico para IMask, caso o script não carregue.
    if (typeof IMask === 'undefined') {
        console.error("ERRO CRÍTICO: A biblioteca IMask não foi carregada. Verifique se o <script src='https://unpkg.com/imask'></script> está no seu HTML.");
        return;
    }

    const REGRA_PADRAO = {
        PERCENTUAL_MULTA: 0.30,
    };

    const CONFIG = {
        DIAS_DO_MES_BASE: 30,
        MAX_MESES_FIDELIDADE: 12,
        MAX_DIAS_DE_USO: 365,
        DEBOUNCE_MS: 300,
        DARK_MODE_KEY: 'simulador_dark_mode',
        PERSISTENCE_KEY: 'simulador_inputs'
    };

    const DOM = {
        planoBase: document.getElementById('planoBase'),
        mesesFidelidadeRestantes: document.getElementById('mesesFidelidadeRestantes'),
        diasDeUso: document.getElementById('diasDeUso'),
        custoEquipamento: document.getElementById('custoEquipamento'),
        svaInputs: Array.from(document.querySelectorAll('.sva-quantity')),
        custoAdicionalInput: document.getElementById('custoAdicionalInput'),
        resultadoCard: document.getElementById('resultadoCard'),
        btnReset: document.getElementById('btnReset'),
        btnToggleDarkMode: document.getElementById('btnToggleDarkMode'),
        btnCopyResults: document.getElementById('btnCopyResults'), // Botão de cópia
        copySuccessMessage: document.getElementById('copySuccessMessage'), // Mensagem de sucesso

        groupPlanoBase: document.getElementById('group-planoBase'),
        groupMesesFidelidadeRestantes: document.getElementById('group-mesesFidelidadeRestantes'),
        groupDiasDeUso: document.getElementById('group-diasDeUso'),

        out: {
            diasACobrar: document.getElementById('diasACobrar'),
            valorMensalTotal: document.getElementById('valorMensalTotal'),
            multaFidelidade: document.getElementById('multaFidelidade'),
            proRata: document.getElementById('proRata'),
            totalSva: document.getElementById('totalSva'),
            equipamento: document.getElementById('equipamento'),
            totalMulta: document.getElementById('totalMulta'),
            custoAdicionalOut: document.getElementById('custoAdicionalOut'),
        }
    };

    const maskOptions = {
        mask: Number,
        scale: 2,
        signed: false,
        thousandsSeparator: '.',
        padFractionalZeros: true,
        normalizeZeros: true,
        radix: ',',
        mapToRadix: ['.'],
    };

    const planoBaseMask = IMask(DOM.planoBase, maskOptions);
    const custoAdicionalMask = IMask(DOM.custoAdicionalInput, maskOptions);

    const fmt = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    function lerInputs() {
        const planoBase = Number(planoBaseMask.typedValue ?? 0);
        const custoAdicional = Number(custoAdicionalMask.typedValue ?? 0);
        const mesesFidelidadeRestantes = Math.min(CONFIG.MAX_MESES_FIDELIDADE, Math.max(0, parseInt(DOM.mesesFidelidadeRestantes.value || 0)));
        const diasDeUso = Math.min(CONFIG.MAX_DIAS_DE_USO, Math.max(0, parseInt(DOM.diasDeUso.value || 0)));
        const custoEquipamento = parseFloat(DOM.custoEquipamento.value || 0) || 0;

        let svaValorTotal = 0;
        let svaData = [];

        DOM.svaInputs.forEach(i => {
            const q = Math.max(0, parseInt(i.value || 0));
            const price = parseFloat(i.dataset.price) || 0;
            svaValorTotal += q * price;
            svaData.push({ name: i.dataset.svaName, quantity: q, total: q * price });
        });

        const data = {
            planoBase,
            mesesFidelidadeRestantes,
            diasDeUso,
            custoEquipamento,
            custoAdicional,
            svaValorTotal,
            svaData,
            planoBaseUnmasked: planoBaseMask.unmaskedValue,
            custoAdicionalUnmasked: custoAdicionalMask.unmaskedValue,
        };

        salvarInputs(data);
        return data;
    }

    function calcular(dados) {
        const valorMensalTotal = dados.planoBase + dados.svaValorTotal;

        let proRataPlanoBase = 0;
        if (dados.diasDeUso > 0 && dados.planoBase > 0) {
            const custoDiarioPlano = dados.planoBase / CONFIG.DIAS_DO_MES_BASE;
            proRataPlanoBase = custoDiarioPlano * dados.diasDeUso;
        }

        const svaTotal = dados.svaValorTotal;

        let multaFidelidade = 0;
        if (dados.mesesFidelidadeRestantes > 0) {
            const valorBaseRestante = dados.planoBase * dados.mesesFidelidadeRestantes;
            multaFidelidade = valorBaseRestante * REGRA_PADRAO.PERCENTUAL_MULTA;
        }

        const equipamento = dados.custoEquipamento;
        const custoAdicional = dados.custoAdicional;

        const total = multaFidelidade + proRataPlanoBase + svaTotal + equipamento + custoAdicional;

        return {
            multaFidelidade,
            proRata: proRataPlanoBase,
            equipamento,
            custoAdicional,
            total,
            valorMensalTotal,
            svaValorTotal: svaTotal
        };
    }

    function renderResultados(res, diasACobrar) {
        DOM.out.diasACobrar.textContent = `${diasACobrar} dias`;
        DOM.out.valorMensalTotal.textContent = fmt(res.valorMensalTotal);
        DOM.out.multaFidelidade.textContent = fmt(res.multaFidelidade);
        DOM.out.proRata.textContent = fmt(res.proRata);
        DOM.out.totalSva.textContent = fmt(res.svaValorTotal);
        DOM.out.equipamento.textContent = fmt(res.equipamento);
        DOM.out.custoAdicionalOut.textContent = fmt(res.custoAdicional);
        DOM.out.totalMulta.textContent = fmt(res.total);
    }

    function isFormEmpty(dados) {
        const totalMonetaryValue = dados.planoBase + dados.svaValorTotal + dados.custoEquipamento + dados.custoAdicional;
        const totalTermValue = dados.mesesFidelidadeRestantes + dados.diasDeUso;
        return totalMonetaryValue === 0 && totalTermValue === 0;
    }

    function calcularEExibir() {
        const dados = lerInputs();
        const planoBaseIsValid = validarCampo(DOM.planoBase);
        const formIsEmpty = isFormEmpty(dados);

        if (formIsEmpty || !planoBaseIsValid) {
            DOM.resultadoCard.classList.remove('visible');
            renderResultados({ multaFidelidade: 0, proRata: 0, equipamento: 0, custoAdicional: 0, totalSva: 0, total: 0, valorMensalTotal: 0 }, 0);
            return;
        }

        DOM.resultadoCard.classList.add('visible');
        const res = calcular(dados);
        renderResultados(res, dados.diasDeUso);
    }

    function debounce(fn, ms) {
        let t;
        return function(...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }
    const debouncedCalc = debounce(calcularEExibir, CONFIG.DEBOUNCE_MS);

    function showFieldError(inputEl, groupEl, errorMessage, isError) {
        if (!groupEl) return;
        groupEl.classList.toggle('has-error', isError);
        inputEl.setAttribute('aria-invalid', isError);
        const errorFeedbackEl = document.getElementById(inputEl.getAttribute('aria-describedby'));
        if (errorFeedbackEl) {
            errorFeedbackEl.textContent = errorMessage;
        }
    }

    function validarCampo(inputEl) {
        let isValid = true;
        let errorMessage = '';

        if (inputEl === DOM.planoBase) {
            const planoBaseValue = parseFloat(planoBaseMask.unmaskedValue) / 100 || 0;
            if (planoBaseValue <= 0) {
                isValid = false;
                errorMessage = "O valor do Plano Base é obrigatório e deve ser maior que R$ 0,00.";
            }
            showFieldError(inputEl, DOM.groupPlanoBase, errorMessage, !isValid);
        } else if (inputEl === DOM.mesesFidelidadeRestantes) {
            const value = parseInt(inputEl.value || 0);
            if (value < 0 || value > CONFIG.MAX_MESES_FIDELIDADE) {
                isValid = false;
                errorMessage = `O número de meses deve ser entre 0 e ${CONFIG.MAX_MESES_FIDELIDADE}.`;
            }
            showFieldError(inputEl, DOM.groupMesesFidelidadeRestantes, errorMessage, !isValid);
        } else if (inputEl === DOM.diasDeUso) {
            const value = parseInt(inputEl.value || 0);
            if (value < 0 || value > CONFIG.MAX_DIAS_DE_USO) {
                isValid = false;
                errorMessage = `O número de dias deve ser entre 0 e ${CONFIG.MAX_DIAS_DE_USO}.`;
            }
            showFieldError(inputEl, DOM.groupDiasDeUso, errorMessage, !isValid);
        }
        return isValid;
    }

    function salvarInputs(dados) {
        try {
            const svaQuantities = DOM.svaInputs.map(i => ({
                price: i.dataset.price,
                q: Math.max(0, parseInt(i.value || 0))
            }));
            const dataToSave = {
                planoBaseUnmasked: dados.planoBaseUnmasked,
                custoAdicionalUnmasked: dados.custoAdicionalUnmasked,
                mesesFidelidadeRestantes: dados.mesesFidelidadeRestantes,
                diasDeUso: dados.diasDeUso,
                custoEquipamento: dados.custoEquipamento,
                svaQuantities: svaQuantities
            };
            localStorage.setItem(CONFIG.PERSISTENCE_KEY, JSON.stringify(dataToSave));
        } catch (e) {
            console.error("Erro ao salvar dados no localStorage:", e);
        }
    }

    function carregarInputs() {
        try {
            const savedData = localStorage.getItem(CONFIG.PERSISTENCE_KEY);
            if (!savedData) return;
            const data = JSON.parse(savedData);
            if (data.planoBaseUnmasked) {
                planoBaseMask.unmaskedValue = data.planoBaseUnmasked;
            }
            if (data.custoAdicionalUnmasked) {
                custoAdicionalMask.unmaskedValue = data.custoAdicionalUnmasked;
            }
            DOM.mesesFidelidadeRestantes.value = data.mesesFidelidadeRestantes || 0;
            DOM.diasDeUso.value = data.diasDeUso || 0;
            DOM.custoEquipamento.value = data.custoEquipamento || 0;
            if (data.svaQuantities) {
                DOM.svaInputs.forEach(inputEl => {
                    const savedSVA = data.svaQuantities.find(s => s.price == inputEl.dataset.price);
                    if (savedSVA) {
                        inputEl.value = savedSVA.q;
                    }
                });
            }
        } catch (e) {
            console.error("Erro ao carregar dados do localStorage:", e);
            localStorage.removeItem(CONFIG.PERSISTENCE_KEY);
        }
    }

    function resetFormulario() {
        DOM.planoBase.value = '';
        planoBaseMask.updateValue();
        DOM.custoAdicionalInput.value = '';
        custoAdicionalMask.updateValue();
        DOM.mesesFidelidadeRestantes.value = 0;
        DOM.diasDeUso.value = 0;
        DOM.custoEquipamento.value = 0;
        DOM.svaInputs.forEach(i => i.value = 0);
        DOM.groupPlanoBase.classList.remove('has-error');
        DOM.planoBase.setAttribute('aria-invalid', 'false');
        DOM.resultadoCard.classList.remove('visible');
        localStorage.removeItem(CONFIG.PERSISTENCE_KEY);
        calcularEExibir();
    }

    function toggleDarkMode() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem(CONFIG.DARK_MODE_KEY, isDarkMode ? 'true' : 'false');
    }

    function initDarkMode() {
        const savedMode = localStorage.getItem(CONFIG.DARK_MODE_KEY);
        if (savedMode === 'true' || (savedMode === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-mode');
        }
    }

    /**
     * Nova função para gerar o texto e copiar para a área de transferência.
     */
    function handleCopyResults() {
        const dados = lerInputs();
        const res = calcular(dados);

        // Se o valor total for zero, não faz nada.
        if (res.total <= 0) {
            return;
        }

        const linesToCopy = [];
        
        // Adiciona a linha do total sempre no início
        linesToCopy.push(`Valor total: ${fmt(res.total)}`);
        linesToCopy.push(''); // Adiciona uma linha em branco para formatação

        // Adiciona as outras linhas apenas se o valor correspondente for maior que zero
        if (dados.planoBase > 0) {
            linesToCopy.push(`Valor do Plano: ${fmt(dados.planoBase)}`);
        }
        if (res.proRata > 0) {
            linesToCopy.push(`Valor do Proporcional: ${fmt(res.proRata)}`);
        }
        if (res.equipamento > 0) {
            linesToCopy.push(`NÃO DEVOLUÇÃO DOS EQUIPAMENTOS: ${fmt(res.equipamento)}`);
        }
        // AQUI ESTAVA O ERRO - AGORA CORRIGIDO
        if (res.multaFidelidade > 0) {
            linesToCopy.push(`Multa fidelidade: ${fmt(res.multaFidelidade)}`);
        }
        if (res.svaValorTotal > 0) {
            linesToCopy.push(`SVA: ${fmt(res.svaValorTotal)}`);
        }
        if (res.custoAdicional > 0) {
            linesToCopy.push(`OUTROS: ${fmt(res.custoAdicional)}`);
        }

        // Converte o array de linhas em um único texto, separado por quebras de linha
        const textToCopy = linesToCopy.join('\n');

        // Usa a API do Clipboard para uma cópia segura e moderna
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Mostra a mensagem de sucesso
            DOM.copySuccessMessage.classList.add('show');
            // Esconde a mensagem após 2 segundos
            setTimeout(() => {
                DOM.copySuccessMessage.classList.remove('show');
            }, 2000);
        }).catch(err => {
            console.error('Falha ao copiar o texto: ', err);
            // Fallback ou alerta para o usuário em caso de erro
            alert('Não foi possível copiar o texto para a área de transferência.');
        });
    }

    // --- EVENT LISTENERS ---
    const allInputs = [
        DOM.planoBase, DOM.mesesFidelidadeRestantes, DOM.diasDeUso,
        DOM.custoEquipamento, DOM.custoAdicionalInput,
        ...DOM.svaInputs
    ];

    allInputs.forEach(input => {
        input.addEventListener('input', debouncedCalc);
        if (input.type === 'number' || input.id === 'custoEquipamento') {
            input.addEventListener('change', () => {
                validarCampo(input);
                debouncedCalc();
            });
        } else if (input === DOM.planoBase) {
            planoBaseMask.on('complete', () => {
                validarCampo(input);
                debouncedCalc();
            });
            planoBaseMask.on('accept', debouncedCalc);
        } else if (input === DOM.custoAdicionalInput) {
            custoAdicionalMask.on('complete', debouncedCalc);
            custoAdicionalMask.on('accept', debouncedCalc);
        }
    });

    DOM.btnReset.addEventListener('click', resetFormulario);
    DOM.btnToggleDarkMode.addEventListener('click', toggleDarkMode);
    // Adiciona o listener de clique para o novo botão de cópia
    DOM.btnCopyResults.addEventListener('click', handleCopyResults);

    // --- INICIALIZAÇÃO ---
    initDarkMode();
    carregarInputs();
    calcularEExibir();
});
