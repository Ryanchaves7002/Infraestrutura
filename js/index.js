// /home/infraestrutura-itatira/Área de Trabalho/Infraestrutura/js/index.js
// GitHub Copilot
(function () {
    // keys & helpers
    const STORAGE_KEY = 'infra_submissions_v1';

    function qs(id) { return document.getElementById(id); }
    function trimAll(s = '') { return s.replace(/\s+/g, ' ').trim(); }
    function norm(s = '') { return trimAll(s).toLowerCase(); }

    // Create toast container & styles
    function ensureToastStyles() {
        if (document.getElementById('infra-toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'infra-toast-styles';
        style.textContent = `
            .infra-toast-wrap{position:fixed;right:20px;top:20px;z-index:99999}
            .infra-toast{min-width:280px;margin-bottom:10px;padding:12px 16px;border-radius:8px;color:#fff;font-family:Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.15);opacity:0;transform:translateY(-8px);transition:all .28s ease}
            .infra-toast.show{opacity:1;transform:translateY(0)}
            .infra-toast.success{background:#28a745}
            .infra-toast.warn{background:#ffc107;color:#222}
            .infra-toast.dup{background:#dc3545}
        `;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.className = 'infra-toast-wrap';
        wrap.id = 'infra-toast-wrap';
        document.body.appendChild(wrap);
    }

    function showToast(message, type = 'success', timeout = 4200) {
        ensureToastStyles();
        const wrap = document.getElementById('infra-toast-wrap');
        const t = document.createElement('div');
        t.className = `infra-toast ${type === 'success' ? 'success' : (type === 'warn' ? 'warn' : 'dup')}`;
        t.textContent = message;
        wrap.appendChild(t);
        // show
        requestAnimationFrame(() => t.classList.add('show'));
        // hide
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 320);
        }, timeout);
    }

    // Storage
    function loadAll() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) { return []; }
    }
    function saveAll(arr) {
        // persist locally
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('localStorage save failed', e);
        }

        // enviar para resolver.js (endpoint que processará os dados)
        try {
            fetch('/resolver.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(arr)
            }).then(res => {
                if (!res.ok) throw new Error('Resposta do servidor não OK: ' + res.status);
                return res.text();
            }).then(() => {
                // opcional: não mostrar toast de sucesso para não poluir a UX
            }).catch(err => {
                console.error('Envio para resolver.js falhou', err);
                showToast('Falha ao enviar dados ao servidor. Dados salvos localmente.', 'warn', 5000);
            });
        } catch (e) {
            console.error('Erro ao iniciar envio para resolver.js', e);
            showToast('Erro ao enviar dados ao servidor. Dados salvos localmente.', 'warn', 5000);
        }
    }

    // Form handling
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.querySelector('form.infra-form');
        if (!form) return;
        // formatar telefone e CEP automaticamente
        const telEl = qs('telefone');
        const cepEl = qs('cep');

        function onlyDigits(s = '') { return s.replace(/\D/g, ''); }

        function formatTelefone(raw) {
            const d = onlyDigits(raw).slice(0, 11);
            if (!d) return '';
            if (d.length <= 2) return `(${d}`;
            if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
            if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
            return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
        }

        function formatCEP(raw) {
            const d = onlyDigits(raw).slice(0, 8);
            if (!d) return '';
            if (d.length <= 5) return d;
            return `${d.slice(0,5)}-${d.slice(5)}`;
        }

        function bindMask(el, formatter, maxLen, autocomplete) {
            if (!el) return;
            el.setAttribute('inputmode', 'numeric');
            if (autocomplete) el.setAttribute('autocomplete', autocomplete);
            if (maxLen) el.setAttribute('maxlength', String(maxLen));

            el.addEventListener('input', () => {
                const start = el.selectionStart || el.value.length;
                const oldLen = el.value.length;
                el.value = formatter(el.value);
                // tentar manter a posição do cursor de forma simples
                const newLen = el.value.length;
                const diff = newLen - oldLen;
                const pos = Math.max(0, start + diff);
                el.selectionStart = el.selectionEnd = pos;
            });

            el.addEventListener('paste', (ev) => {
                ev.preventDefault();
                const text = (ev.clipboardData || window.clipboardData).getData('text');
                el.value = formatter(text);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            });

            el.addEventListener('blur', () => {
                el.value = formatter(el.value);
            });
        }

        bindMask(telEl, formatTelefone, 15, 'tel');
        bindMask(cepEl, formatCEP, 9, 'postal-code');
        // fields
        const fields = {
            nome: qs('nome'),
            sobrenome: qs('sobrenome'),
            email: qs('email'),
            telefone: qs('telefone'),
            endereco: qs('endereco'),
            referencia: qs('referencia'),
            cidade: qs('cidade'),
            cep: qs('cep'),
            descricao: qs('descricao')
        };

        const required = ['nome','sobrenome','telefone','endereco','referencia','cidade','cep','descricao']; // email optional

        function markError(el, on) {
            if (!el) return;
            if (on) {
                el.style.boxShadow = '0 0 0 0.15rem rgba(220,53,69,.25)';
                el.style.borderColor = '#dc3545';
            } else {
                el.style.boxShadow = '';
                el.style.borderColor = '';
            }
        }

        function validate() {
            let ok = true;
            required.forEach(k => {
                const v = fields[k] ? trimAll(fields[k].value) : '';
                if (!v) { markError(fields[k], true); ok = false; }
                else markError(fields[k], false);
            });
            return ok;
        }

        function sameIdentity(a, b) {
            // identity = nome + sobrenome + telefone (normalized)
            return norm(a.nome) === norm(b.nome) &&
                         norm(a.sobrenome) === norm(b.sobrenome) &&
                         norm(a.telefone) === norm(b.telefone);
        }

        form.addEventListener('submit', (ev) => {
            ev.preventDefault();

            if (!validate()) {
                showToast('Preencha todos os campos obrigatórios (exceto email).', 'warn', 3800);
                return;
            }

            const submission = {
                nome: trimAll(fields.nome.value),
                sobrenome: trimAll(fields.sobrenome.value),
                email: trimAll(fields.email.value) || null,
                telefone: trimAll(fields.telefone.value),
                endereco: trimAll(fields.endereco.value),
                referencia: trimAll(fields.referencia.value),
                cidade: trimAll(fields.cidade.value),
                cep: trimAll(fields.cep.value),
                descricao: trimAll(fields.descricao.value),
                createdAt: new Date().toISOString()
            };

            const all = loadAll();

            // check duplicates: same user and same descricao (normalize)
            const duplicate = all.find(prev => {
                return sameIdentity(prev, submission) && norm(prev.descricao) === norm(submission.descricao);
            });

            if (duplicate) {
                showToast('Seu problema já foi cadastrado, por favor aguarde!', 'dup', 5000);
                return;
            }

            // not duplicate -> save
            all.push(submission);
            saveAll(all);
            // success toast
            showToast('Seu problema está em análise, e breve terá um retorno eficaz !', 'success', 4800);

            // optional: clear form except email maybe keep? We'll clear all.
            form.reset();
            // remove error styling if any
            Object.values(fields).forEach(f => f && markError(f, false));
        });
    });
})();
