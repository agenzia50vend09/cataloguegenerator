// --- CONFIGURAZIONE WEB APP GOOGLE SHEETS ---
const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.currentView = { type: 'home', value: null }; // home, all, brand, type, packtype
        
        this.init();
    }

    async init() {
        await this.loadDataFromSheets();
        
        if (this.products && this.products.length > 0) {
            this.buildFilterMenus();
        }

        // Il controllo della sessione admin nasconderà o mostrerà il catalogo e la navbar utente
        this.checkAdminSession();
    }

    async loadDataFromSheets() {
        try {
            const response = await fetch(`${API_URL}?_=${Date.now()}`);
            if (!response.ok) throw new Error("Risposta del server non valida");
            
            const data = await response.json();
            this.products = data.prodotti || [];
            this.credentials = data.credenziali || [];
        } catch (error) {
            console.error("Errore nel caricamento dati da Google Sheets:", error);
            alert("Impossibile connettersi al database di Google Fogli. Verranno usati dati locali simulati.");
            this.loadMockData();
        }
    }

    async syncWithSheets(action, payload) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action, data: payload })
            });
            
            await this.loadDataFromSheets();
            if (this.isAdminActive()) {
                this.render();
                this.renderAdminTable();
            }
        } catch (error) {
            console.error("Errore di sincronizzazione:", error);
            alert("Si è verificato un errore durante il salvataggio dei dati su Google Fogli.");
        }
    }

    isAdminActive() {
        return localStorage.getItem('isAdminSession') === 'true';
    }

    checkAdminSession() {
        const adminPanel = document.getElementById('admin-panel');
        const adminGateBtn = document.getElementById('btn-admin-gate');
        const userNavControls = document.getElementById('user-nav-controls');
        const mainContent = document.getElementById('main-content');

        if (this.isAdminActive()) {
            if (adminPanel) adminPanel.classList.remove('hidden');
            if (userNavControls) userNavControls.classList.remove('hidden');
            if (mainContent) mainContent.classList.remove('hidden'); // L'admin sblocca la vista catalogo
            if (adminGateBtn) adminGateBtn.innerHTML = '<i class="fa-solid fa-unlock"></i> Pannello Aperto';
            
            this.renderAdminTable();
            this.render(); 
        } else {
            if (adminPanel) adminPanel.classList.add('hidden');
            if (userNavControls) userNavControls.classList.add('hidden');
            if (mainContent) mainContent.classList.add('hidden'); // L'utente normale non vede nulla del catalogo
            if (adminGateBtn) adminGateBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin';
        }
    }

    toggleAdminModal(show) {
        const modal = document.getElementById('login-modal');
        if (modal) modal.style.display = show ? 'flex' : 'none';
    }

    handleLogin(e) {
        e.preventDefault();
        const userIn = document.getElementById('username').value;
        const passIn = document.getElementById('password').value;

        const valid = this.credentials.some(c => c.username === userIn && c.password === passIn);

        if (valid) {
            localStorage.setItem('isAdminSession', 'true');
            localStorage.setItem('currentAdminUser', userIn); // Salviamo l'utente corrente per ricavare il numero WhatsApp dopo
            this.toggleAdminModal(false);
            this.checkAdminSession();
            document.getElementById('login-form').reset();
        } else {
            alert("Credenziali non valide. Riprova.");
        }
    }

    handleLogout() {
        localStorage.removeItem('isAdminSession');
        localStorage.removeItem('currentAdminUser');
        this.checkAdminSession();
    }

    buildFilterMenus() {
        const types = ['gum', 'caramella', 'lollipop', 'gommose'];
        const packtypes = ['stick', 'box', 'monopezzo', 'lollipop', 'busta', 'bottle', 'expo'];

        const typeContainer = document.getElementById('dropdown-type');
        if (typeContainer) {
            typeContainer.innerHTML = types.map(t => `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`).join('');
        }

        const packContainer = document.getElementById('dropdown-packtype');
        if (packContainer) {
            packContainer.innerHTML = packtypes.map(p => `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`).join('');
        }
    }

    setFilter(filterType, value) {
        this.currentView = { type: filterType, value: value };
        this.render();
    }

    viewAllProducts() {
        this.currentView = { type: 'all', value: null };
        this.render();
    }

    renderCatalog() {
        this.currentView = { type: 'home', value: null };
        this.render();
    }

    handleUrlPreview(url) {
        const previewContainer = document.getElementById('photo-preview-container');
        const previewImg = document.getElementById('photo-preview');

        if (url && url.trim() !== "") {
            if (previewImg) previewImg.src = this.getPhotoUrl(url);
            if (previewContainer) previewContainer.classList.remove('hidden');
        } else {
            if (previewContainer) previewContainer.classList.add('hidden');
        }
    }

    getPhotoUrl(photoData) {
        if (!photoData || photoData.trim() === "" || photoData.startsWith('photo_')) {
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%" y="50%" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dy=".3em"%3ENessuna foto%3C/text%3E%3C/svg%3E';
        }

        let url = photoData.trim();

        if (url.includes("drive.google.com")) {
            let matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
            if (matches && matches[1]) {
                return `https://lh3.googleusercontent.com/d/${matches[1]}`;
            }
        }
        return url;
    }

    // --- RENDERING CATALOGO PRODOTTI ---
    render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = ''; 

        const ordinaPerNovita = (lista) => {
            return [...lista].sort((a, b) => {
                const aNovita = String(a.novita) === 'true' ? 1 : 0;
                const bNovita = String(b.novita) === 'true' ? 1 : 0;
                return bNovita - aNovita; 
            });
        };

        if (this.currentView.type === 'home') {
            const novitaProducts = this.products.filter(p => String(p.novita) === 'true');
            if (novitaProducts.length > 0) {
                container.appendChild(this.createSectionHeading("✨ Novità In Evidenza"));
                container.appendChild(this.createGrid(novitaProducts));
            }

            const brands = [...new Set(this.products.map(p => p.brand))];
            
            brands.forEach(brand => {
                const tuttiIProdottiDelBrand = this.products.filter(p => p.brand === brand);
                const brandProducts = ordinaPerNovita(tuttiIProdottiDelBrand).slice(0, 3);
                
                const headingEl = document.createElement('h2');
                headingEl.className = 'section-title';
                headingEl.innerHTML = `<span class="brand-title" onclick="app.setFilter('brand', '${brand}')">${brand} »</span>`;
                
                container.appendChild(headingEl);
                container.appendChild(this.createGrid(brandProducts));
            });
        } 
        else {
            let filteredList = [];
            let titleText = "";
            const listaGlobaleOrdinata = ordinaPerNovita(this.products);

            switch(this.currentView.type) {
                case 'all':
                    filteredList = listaGlobaleOrdinata;
                    titleText = "Tutto il Catalogo Prodotti";
                    break;
                case 'brand':
                    filteredList = listaGlobaleOrdinata.filter(p => p.brand === this.currentView.value);
                    titleText = `Prodotti del Brand: ${this.currentView.value}`;
                    break;
                case 'type':
                    filteredList = listaGlobaleOrdinata.filter(p => p.type === this.currentView.value);
                    titleText = `Categoria: ${this.currentView.value}`;
                    break;
                case 'packtype':
                    filteredList = listaGlobaleOrdinata.filter(p => p.packtype === this.currentView.value);
                    titleText = `Confezione: ${this.currentView.value}`;
                    break;
            }

            container.appendChild(this.createSectionHeading(titleText));
            container.appendChild(this.createGrid(filteredList));
        }
    }

    createSectionHeading(text) {
        const h2 = document.createElement('h2');
        h2.className = 'section-title';
        h2.innerText = text;
        return h2;
    }

    createGrid(productsList) {
        const grid = document.createElement('div');
        grid.className = 'grid-products';

        if(!productsList || productsList.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--gray-text);">Nessun prodotto trovato in questa selezione.</p>`;
            return grid;
        }

        productsList.forEach(prod => {
            const isDisponibile = String(prod.disponibile) === 'true';
            const isNovita = String(prod.novita) === 'true';
            const photoUrl = this.getPhotoUrl(prod.foto);

            const card = document.createElement('div');
            card.className = `product-card ${!isDisponibile ? 'out-of-stock' : ''}`;
            
            card.innerHTML = `
                ${isNovita ? '<div class="badge-novita">Novità</div>' : ''}
                <div class="product-img-container">
                    <img src="${photoUrl}" alt="${prod.nome}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22%3EFoto non disponibile%3C/text%3E%3C/svg%3E'">
                </div>
                <div class="product-info">
                    <div class="product-brand">${prod.brand}</div>
                    <div class="product-name">${prod.nome}</div>
                    <div class="product-desc">${prod.descrizione}</div>
                    <div class="product-meta">
                        <span><i class="fa-solid fa-boxes-stacked"></i> ${prod.packtype}</span>
                        <span>🏷️ ${prod.type}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="product-price">${parseFloat(prod.prezzo || 0).toFixed(2)}€</span>
                        <span style="font-size:12px; font-weight:bold; color:${isDisponibile ? 'var(--success-green)' : 'var(--danger-red)'}">
                            ${isDisponibile ? 'Disponibile' : 'Esaurito'}
                        </span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        return grid;
    }

    // --- FUNZIONALITÀ DI ESPORTAZIONE (PDF & WHATSAPP) ---
    generateCatalogPDF() {
        // 1. Salva temporaneamente la vista corrente per poterla ripristinare alla fine
        const previousView = this.currentView;

        // 2. Crea il contenitore temporaneo nascosto per impaginare tutto il catalogo continuo
        const pdfContainer = document.createElement('div');
        pdfContainer.id = 'pdf-continuous-container';
        // Stili per garantire lo sfondo bianco e font coerenti
        pdfContainer.style.cssText = "background: white; padding: 30px; font-family: sans-serif; width: 1024px; box-sizing: border-box;";

        const ordinaPerNovita = (lista) => {
            return [...lista].sort((a, b) => {
                const aNovita = String(a.novita) === 'true' ? 1 : 0;
                const bNovita = String(b.novita) === 'true' ? 1 : 0;
                return bNovita - aNovita; 
            });
        };

        // 3. Genera l'Header del Catalogo
        const header = document.createElement('header');
        header.style.cssText = "background: #002d62; color: white; padding: 30px; text-align: center; margin-bottom: 30px; border-radius: 8px;";
        header.innerHTML = "<h1 style='margin:0; font-size:32px;'>SWEETS</h1><p style='margin:5px 0 0 0;'>Catalogo Prodotti Ufficiale</p>";
        pdfContainer.appendChild(header);

        // 4. Genera la sezione Novità se presente
        const novitaProducts = this.products.filter(p => String(p.novita) === 'true');
        if (novitaProducts.length > 0) {
            pdfContainer.appendChild(this.createSectionHeading("✨ Novità In Evidenza"));
            pdfContainer.appendChild(this.createGrid(novitaProducts));
        }

        // 5. Estrae tutti i brand e mostra TUTTI i prodotti
        const brands = [...new Set(this.products.map(p => p.brand))];
        brands.forEach(brand => {
            const tuttiIProdottiDelBrand = this.products.filter(p => p.brand === brand);
            const brandProducts = ordinaPerNovita(tuttiIProdottiDelBrand);
            
            const headingEl = document.createElement('h2');
            headingEl.className = 'section-title';
            headingEl.innerHTML = `<span class="brand-title">${brand}</span>`;
            
            pdfContainer.appendChild(headingEl);
            pdfContainer.appendChild(this.createGrid(brandProducts));
        });

        // 6. Appendiamo momentaneamente al body (invisibile) per iniettare gli stili corretti delle card quadrate
        document.body.appendChild(pdfContainer);

        // Iniettiamo un blocco di stili CSS temporaneo specifico per forzare il layout continuo quadrato
        const styleOverride = document.createElement('style');
        styleOverride.id = 'pdf-style-override';
        styleOverride.innerHTML = `
            #pdf-continuous-container .grid-products { 
                display: grid !important; 
                grid-template-columns: repeat(3, 1fr) !important; 
                gap: 20px !important; 
                margin-bottom: 30px !important;
            }
            #pdf-continuous-container .product-card { 
                display: flex !important;
                flex-direction: column !important;
                aspect-ratio: 1 / 1 !important;
                width: 100% !important;
                height: auto !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
                background: #ffffff !important;
                border: 1px solid #dbe2ef !important;
                border-radius: 12px !important;
            }
            #pdf-continuous-container .product-img-container {
                height: 45% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 10px !important;
                box-sizing: border-box !important;
            }
            #pdf-continuous-container .product-img-container img {
                max-width: 100% !important;
                max-height: 100% !important;
                object-fit: contain !important;
            }
            #pdf-continuous-container .product-info {
                height: 55% !important;
                padding: 12px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                box-sizing: border-box !important;
            }
            #pdf-continuous-container .product-name {
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            #pdf-continuous-container .product-desc {
                display: -webkit-box !important;
                -webkit-line-clamp: 2 !important;
                -webkit-box-orient: vertical !important;
                overflow: hidden !important;
                height: 32px !important;
            }
        `;
        document.head.appendChild(styleOverride);

        // 7. Configurazione di html2pdf per generare un FOGLIO CONTINUO (Senza interruzioni di pagina)
        const opzioni = {
            margin:       0,
            filename:     'Sweets_Catalogo_Continuo.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true }, // scale 2 mantiene alta la qualità delle immagini
            jsPDF:        { unit: 'px', format: [1024, pdfContainer.scrollHeight], orientation: 'portrait' } 
            // Sopra: calcola l'altezza esatta (scrollHeight) dinamica del catalogo per farlo diventare una pagina unica!
        };

        // Carica la libreria al volo se non è inclusa nell'index.html e lancia la conversione
        const generaFile = () => {
            html2pdf().set(opzioni).from(pdfContainer).save().then(() => {
                // Sotto-pulizia degli elementi temporanei
                document.body.removeChild(pdfContainer);
                document.head.removeChild(styleOverride);
                // Ripristina l'applicazione allo stato iniziale
                this.currentView = previousView;
                this.render();
            });
        };

        if (typeof html2pdf === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = generaFile;
            document.head.appendChild(script);
        } else {
            generaFile();
        }
    }

    // --- LOGICA PANNELLO ADMIN ---
    renderAdminTable() {
        const tbody = document.getElementById('admin-table-body');
        if (!tbody) return;
        
        if (!this.products || this.products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nessun dato disponibile</td></tr>`;
            return;
        }

        tbody.innerHTML = this.products.map(p => {
            const photoUrl = this.getPhotoUrl(p.foto);
            return `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td><img src="${photoUrl}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23f0f0f0%22 width=%2240%22 height=%2240%22/%3E%3C/svg%3E'"></td>
                <td>${p.brand}</td>
                <td>${p.nome}</td>
                <td>${parseFloat(p.prezzo || 0).toFixed(2)}€</td>
                <td>
                    <div class="admin-actions-btns">
                        <button type="button" class="btn-outline" style="padding:5px 10px; font-size:12px;" onclick="app.loadProductIntoForm('${p.id}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                        <button type="button" class="btn-danger" style="padding:5px 10px; font-size:12px;" onclick="app.deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const fotoValue = document.getElementById('prod-foto').value;
        
        if (!fotoValue || fotoValue.trim() === "") {
            alert('Inserisci un URL valido per la foto del prodotto.');
            return;
        }
        
        const inputPrezzo = document.getElementById('prod-prezzo').value;
        const parsedPrezzo = parseFloat(inputPrezzo);

        if (isNaN(parsedPrezzo)) {
            alert('Inserisci un prezzo numerico valido.');
            return;
        }

        const productData = {
            id: id || 'P' + Date.now().toString().slice(-6),
            brand: document.getElementById('prod-brand').value,
            nome: document.getElementById('prod-nome').value,
            descrizione: document.getElementById('prod-descrizione').value,
            prezzo: parsedPrezzo, 
            disponibile: String(document.getElementById('prod-disponibile').checked),
            novita: String(document.getElementById('prod-novita').checked),
            type: document.getElementById('prod-type').value,
            packtype: document.getElementById('prod-packtype').value,
            foto: fotoValue.trim()
        };

        if (id) {
            this.syncWithSheets('update', productData);
        } else {
            this.syncWithSheets('create', productData);
        }

        this.resetProductForm();
    }

    loadProductIntoForm(id) {
        const prod = this.products.find(p => String(p.id) === String(id));
        if(!prod) return;

        document.getElementById('form-title').innerText = "Modifica Prodotto #" + prod.id;
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-brand').value = prod.brand;
        document.getElementById('prod-nome').value = prod.nome;
        document.getElementById('prod-descrizione').value = prod.descrizione;
        document.getElementById('prod-prezzo').value = parseFloat(prod.prezzo || 0);
        document.getElementById('prod-disponibile').checked = String(prod.disponibile) === 'true';
        document.getElementById('prod-novita').checked = String(prod.novita) === 'true';
        document.getElementById('prod-type').value = prod.type;
        document.getElementById('prod-packtype').value = prod.packtype;
        document.getElementById('prod-foto').value = prod.foto;
        this.handleUrlPreview(prod.foto);

        const cancelBtn = document.getElementById('btn-cancel-edit');
        const saveBtn = document.getElementById('btn-save');
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        if (saveBtn) saveBtn.innerText = "Aggiorna Prodotto";
        
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            window.scrollTo({top: adminPanel.offsetTop, behavior: 'smooth'});
        }
    }

    deleteProduct(id) {
        if(confirm(`Sei sicuro di voler eliminare il prodotto ID #${id}?`)) {
            this.syncWithSheets('delete', { id: id });
        }
    }

    resetProductForm() {
        const form = document.getElementById('product-form');
        if (form) form.reset();
        
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-foto').value = '';
        document.getElementById('form-title').innerText = "Aggiungi Nuovo Prodotto";
        document.getElementById('btn-save').innerText = "Salva Prodotto";
        
        const cancelBtn = document.getElementById('btn-cancel-edit');
        const previewContainer = document.getElementById('photo-preview-container');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (previewContainer) previewContainer.classList.add('hidden');
    }

    loadMockData() {
        this.credentials = [{username: "admin", password: "password", telefono: "+393331234567"}];
        this.products = [
            {id: "1", brand: "Frizz", nome: "Goleador Cola", descrizione: "Caramelle gommose frizzanti gusto Cola.", prezzo: 0.20, disponibile: true, novita: true, packtype: "monopezzo", type: "gommose", foto: ""},
            {id: "3", brand: "Chupa", nome: "Chupa Chups Fragola", descrizione: "Il lollipop più famoso al mondo.", prezzo: 0.50, disponibile: true, novita: true, packtype: "lollipop", type: "lollipop", foto: ""}
        ];
        this.buildFilterMenus();
    }
}

const app = new CatalogApp();
