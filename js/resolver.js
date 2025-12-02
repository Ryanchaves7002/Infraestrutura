(function(){
    // dados locais
    let atendimentos = JSON.parse(localStorage.getItem('infra_submissions_v1') || '[]');

    // converter submissions do index.js para atendimentos do resolver.js
    atendimentos = atendimentos.map(item => {
        const titulo = [item.nome, item.sobrenome].filter(Boolean).join(' ') || 'Atendimento';
        return {
            id: uid(),
            titulo,
            descricao: item.descricao || '',
            data: item.createdAt || new Date().toLocaleString(),
            status: 'para'
        };
    });

    // NOVO: resolvidos separados
    let resolvidos = JSON.parse(localStorage.getItem('infra_resolvidos_v1') || '[]');

    let selectedTab = 'para';
    const cardsEl = document.getElementById('cards');
    const toastEl = document.getElementById('toast');

    // util: cria id simples
    function uid(){ 
        return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    }

    // adiciona um atendimento
    function addAtendimento(a){
        const item = Object.assign({
            id: uid(),
            titulo: a.titulo || ('Atendimento ' + (atendimentos.length + 1)),
            descricao: a.descricao || '',
            data: a.data || new Date().toLocaleString(),
            status: a.status || 'para'
        }, a);
        atendimentos.unshift(item);
        saveAndRender();
    }

    function saveAndRender(){
        localStorage.setItem('infra_submissions_v1', JSON.stringify(atendimentos));
        localStorage.setItem('infra_resolvidos_v1', JSON.stringify(resolvidos));
        render();
    }

    function render(){
        const counts = { para:0, realizado:0, atrasado:0, resolvido:0 };

        // contar só os atendimentos NÃO resolvidos
        atendimentos.forEach(it => { if(counts[it.status] !== undefined) counts[it.status]++; });

        // resolvidos contam separado
        counts.resolvido = resolvidos.length;

        document.getElementById('count-para').textContent = counts.para;
        document.getElementById('count-realizado').textContent = counts.realizado;
        document.getElementById('count-atrasado').textContent = counts.atrasado;
        document.getElementById('count-resolvido').textContent = counts.resolvido;

        document.querySelectorAll('.tab').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === selectedTab)
        );

        cardsEl.innerHTML = '';

        let list = [];

        if(selectedTab === 'resolvido'){
            list = resolvidos;
            document.getElementById('btnLimparResolvidos').style.display = 'block';
        } else {
            list = atendimentos.filter(it => it.status === selectedTab);
            document.getElementById('btnLimparResolvidos').style.display = 'none';
        }

        if(list.length === 0){
            cardsEl.innerHTML = '<div style="grid-column:1/-1;padding:20px;background:#fff;border:1px dashed #ddd;border-radius:8px;color:#666">Nenhum atendimento nesta aba</div>';
            return;
        }

        list.forEach(it => {
            const card = document.createElement('div');
            card.className = 'card';

            card.innerHTML = `
                <h4>${escapeHtml(it.titulo)}</h4>
                <div class="meta">${escapeHtml(it.descricao)}</div>
                <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
                    <div><span class="badge">${formatStatus(it.status)}</span> 
                    <small style="color:#888">${escapeHtml(it.data)}</small></div>
                    <div></div>
                </div>
            `;

            const controls = document.createElement('div');
            controls.style.marginTop = '10px';

            if(selectedTab !== 'resolvido'){
                const btn = document.createElement('button');
                btn.className = 'btn';
                btn.textContent = 'Resolver';
                btn.onclick = () => resolveAtendimento(it.id);
                controls.appendChild(btn);

                const btn2 = document.createElement('button');
                btn2.className = 'btn btn-secondary';
                btn2.textContent = 'Marcar como realizado';
                btn2.style.marginLeft = '8px';
                btn2.onclick = () => { updateStatus(it.id, 'realizado'); showToast('Marcado como realizado'); };
                controls.appendChild(btn2);
            } else {
                const info = document.createElement('span');
                info.textContent = 'Já resolvido';
                info.style.color = '#0a6';
                controls.appendChild(info);
            }

            card.appendChild(controls);
            cardsEl.appendChild(card);
        });
    }

    // atualizar status normal
    function updateStatus(id, status){
        const it = atendimentos.find(x => x.id === id);
        if(!it) return;
        it.status = status;
        saveAndRender();
    }

    // NOVO: mover para resolvidos
    function resolveAtendimento(id){
        const it = atendimentos.find(x => x.id === id);
        if(!it) return;

        // tira da lista de ativos
        atendimentos = atendimentos.filter(x => x.id !== id);

        // coloca na lista de resolvidos
        resolvidos.push({
            ...it,
            status: 'resolvido'
        });

        saveAndRender();
        showToast('Resolvido com sucesso');

        selectedTab = 'resolvido';
        render();
    }

    // toast
    let toastTimer = null;
    function showToast(txt){
        toastEl.textContent = txt;
        toastEl.style.opacity = '1';
        toastEl.style.transform = 'translateY(0)';
        if(toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(()=> {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateY(10px)';
        }, 2400);
    }

    // helpers
    function formatStatus(s){
        switch(s){
            case 'para': return 'Para realizar';
            case 'realizado': return 'Realizado';
            case 'atrasado': return 'Atrasado';
            case 'resolvido': return 'Resolvido';
            default: return s;
        }
    }
    function escapeHtml(t){ 
        return String(t||'')
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;'); 
    }

    // tab handlers
    document.querySelectorAll('.tab').forEach(b =>
        b.addEventListener('click', () => {
            selectedTab = b.dataset.tab;
            render();
        })
    );

    // aceitar via postMessage
    window.addEventListener('message', (e) => {
        if(!e.data) return;
        if(e.data.atendimento) addAtendimento(e.data.atendimento);
        if(Array.isArray(e.data.atendimentos)) e.data.atendimentos.forEach(addAtendimento);
    });

    // fallback ?data=...
    try {
        const q = new URLSearchParams(location.search).get('data');
        if(q){
            const raw = JSON.parse(decodeURIComponent(q));

            function toAtendimento(item){
                if(!item) return null;
                if(item.titulo || item.descricao){
                    return {
                        id: item.id,
                        titulo: item.titulo,
                        descricao: item.descricao || '',
                        data: item.data || item.createdAt || new Date().toLocaleString(),
                        status: item.status || 'para'
                    };
                }
                const titulo = [item.nome, item.sobrenome].filter(Boolean).join(' ') 
                    || item.email || item.telefone || 'Atendimento';
                return {
                    titulo,
                    descricao: item.descricao || '',
                    data: item.createdAt || new Date().toLocaleString(),
                    status: 'para'
                };
            }

            let parsed = Array.isArray(raw)
                ? raw.map(toAtendimento).filter(Boolean)
                : toAtendimento(raw);

            if(Array.isArray(parsed)) parsed.forEach(addAtendimento);
            else if(parsed) addAtendimento(parsed);
        }
    } catch(e){}

    // botão limpar resolvidos
    document.getElementById('btnLimparResolvidos').addEventListener('click', () => {
        resolvidos = [];
        saveAndRender();
        showToast("Resolvidos apagados!");
    });

    // inicial
    render();

    window.__addAt = addAtendimento;
})();
