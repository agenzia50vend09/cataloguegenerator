// --- CONFIGURAZIONE WEB APP GOOGLE SHEETS ---
const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.currentUserPhone = ""; // Memorizza il cellulare dell'admin loggato
        this.init();
    }

    async init() {
        await this.loadDataFromSheets();
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
        const mainContent = document.getElementById('main-content');

        if (this.isAdminActive()) {
            if (adminPanel) adminPanel.classList.remove('hidden');
            if (adminGateBtn) adminGateBtn.innerHTML = '<i class="fa-solid fa-unlock"></i> Pannello Aperto';
            if (mainContent) mainContent.innerHTML = '<p style="text-align:center; color:var(--primary-blue); font-weight:600;">Accesso Admin Eseguito. Gestisci il catalogo e genera i PDF dalle sezioni sottostanti.</p>';
            this.currentUserPhone = localStorage.getItem('adminPhone') || "";
            this.renderAdminTable();
        } else {
            if (adminPanel) adminPanel.classList.add('hidden');
            if (adminGateBtn) adminGateBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin';
            if (mainContent) mainContent.innerHTML = '<h2 style="text-align:center; margin-top:40px; color:var(--gray-text);">Benvenuto. Catalogo privato, effettua il login amministratore per procedere.</h2>';
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

        // Cerca la corrispondenza includendo il nuovo campo cellulare richiesto
        const account = this.credentials.find(c => c.username === userIn && c.password === passIn);

        if (account) {
            localStorage.setItem('isAdminSession', 'true');
            // Salviamo il cellulare recuperato dal foglio Google credenziali
            localStorage.setItem('adminPhone', account.cellulare || "");
            this.currentUserPhone = account.cellulare || "";
            
            this.toggleAdminModal(false);
            this.checkAdminSession();
            document.getElementById('login-form').reset();
        } else {
            alert("Credenziali non valide. Riprova.");
        }
    }

    handleLogout() {
        localStorage.removeItem('isAdminSession');
        localStorage.removeItem('adminPhone');
        this.currentUserPhone = "";
        this.checkAdminSession();
    }

    getPhotoUrl(photoData) {
        if (!photoData || photoData.trim() === "" || photoData.startsWith('photo_')) {
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3C/svg%3E';
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

    // --- LOGICA DI ORDINAMENTO STRUTTURATA (VECCHIO CATALOGO PUBBLICO) ---
    getOrderedProductsStructure() {
        const ordinaPerNovita = (lista) => {
            return [...lista].sort((a, b) => {
                const aNovita = String(a.novita) === 'true' ? 1 : 0;
                const bNovita = String(b.novita) === 'true' ? 1 : 0;
                return bNovita - aNovita; 
            });
        };

        const novitaGenerali = this.products.filter(p => String(p.novita) === 'true');
        const brands = [...new Set(this.products.map(p => p.brand))];
        const strutturaBrand = {};

        brands.forEach(brand => {
            const prodottiDelBrand = this.products.filter(p => p.brand === brand);
            // Ordina inserendo la novità in testa per ciascun brand
            strutturaBrand[brand] = ordinaPerNovita(prodottiDelBrand);
        });

        return { novitaGenerali, strutturaBrand };
    }

    // --- GENERATORE DI CATALOGO PDF A RIQUADRI (STILE GRID DEL SITO) ED INVIO WA ---
    generateAndSendPDF(sendWhatsApp = false) {
        if (!this.products || this.products.length === 0) {
            alert("Nessun prodotto disponibile per generare il catalogo.");
            return;
        }

        const { jsPDF } = window.jspdf;
        // Creiamo il documento in formato A4 (210mm x 297mm)
        const doc = new jsPDF('p', 'mm', 'a4');
        
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 14;
        
        // Dimensioni delle card (strutturate a 2 colonne come sul sito in modalità responsive/tablet)
        const cardWidth = 86;
        const cardHeight = 75;
        const gapX = 10;
        const gapY = 10;
        
        let currentY = 35;
        const dataStruttura = this.getOrderedProductsStructure();

        // Funzione di utilità per stampare l'intestazione della pagina
        const stampaHeaderPagina = (numeroPagina) => {
            doc.setFillColor(0, 45, 98); // --dark-blue dello style.css
            doc.rect(0, 0, pageWidth, 24, 'F');
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(255, 255, 255);
            doc.text("SWEETS CATALOGUE", margin, 16);
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Aggiornato il: ${new Date().toLocaleDateString('it-IT')} | Pag. ${numeroPagina}`, pageWidth - margin - 50, 15);
        };

        // Inizializza la prima pagina
        let paginaCorrente = 1;
        stampaHeaderPagina(paginaCorrente);

        // Funzione interna per disegnare una singola card di un prodotto
        const disegnaCardProdotto = (prod, x, y) => {
            const isDisponibile = String(prod.disponibile) === 'true';
            const isNovita = String(prod.novita) === 'true';

            // 1. Sfondo del riquadro (Card bianca con bordo)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(219, 226, 239); // --border-color dello style.css
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

            // 2. Eventuale Badge "Novità" (Riquadro blu in alto a sinistra)
            if (isNovita) {
                doc.setFillColor(0, 136, 204); // --accent-blue
                doc.roundedRect(x + 4, y + 4, 16, 5, 1, 1, 'F');
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(255, 255, 255);
                doc.text("NOVITÀ", x + 5.5, y + 7.5);
            }

            // 3. Informazioni Prodotto (Dati testuali incolonnati)
            let testoY = y + 15;

            // Brand
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(0, 136, 204); // --accent-blue
            doc.text(String(prod.brand).toUpperCase(), x + 5, testoY);
            testoY += 5;

            // Nome Prodotto
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(0, 45, 98); // --dark-blue
            // Evita che il nome esca dai margini della card tagliandolo se troppo lungo
            const nomeTroncato = doc.splitTextToSize(prod.nome, cardWidth - 10)[0];
            doc.text(nomeTroncato, x + 5, testoY);
            testoY += 6;

            // Descrizione (Con ritorno a capo automatico multilinea come nel sito)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(74, 85, 104); // --gray-text
            const lineeDescrizione = doc.splitTextToSize(prod.descrizione || "", cardWidth - 10);
            // Mostra al massimo 3 linee di descrizione per non rompere il layout del riquadro
            const lineeDaMostrare = lineeDescrizione.slice(0, 3);
            lineeDaMostrare.forEach(linea => {
                doc.text(linea, x + 5, testoY);
                testoY += 4.5;
            });

            // 4. Sezione Meta a fondo riquadro (Tipo Pack e Tipo Categoria)
            const metaY = y + 54;
            doc.setFillColor(248, 249, 250); // --gray-bg
            doc.rect(x + 1, metaY, cardWidth - 2, 8, 'F');
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(74, 85, 104);
            doc.text(`Pack: ${prod.packtype}`, x + 5, metaY + 5.5);
            doc.text(`Cat: ${prod.type}`, x + cardWidth - 30, metaY + 5.5);

            // 5. Prezzo e Disponibilità (Fondo card)
            const bottomY = y + 69;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(0, 86, 179); // --primary-blue
            doc.text(`${parseFloat(prod.prezzo || 0).toFixed(2)}€`, x + 5, bottomY);

            doc.setFontSize(9);
            if (isDisponibile) {
                doc.setTextColor(40, 167, 69); // --success-green
                doc.text("Disponibile", x + cardWidth - 23, bottomY);
            } else {
                doc.setTextColor(220, 53, 69); // --danger-red
                doc.text("Esaurito", x + cardWidth - 18, bottomY);
            }
        };

        // Renderizziamo i prodotti seguendo l'ordinamento richiesto
        let colonna = 0; // 0 = Sinistra, 1 = Destra

        // Funzione per gestire il posizionamento e i cambi pagina dei riquadri
        const inserisciCardNelFlusso = (prod) => {
            // Calcola la X in base alla colonna (Sinistra o Destra)
            const x = margin + colonna * (cardWidth + gapX);
            
            // Se lo spazio verticale è esaurito, passa alla pagina successiva
            if (currentY + cardHeight > pageHeight - margin) {
                doc.addPage();
                paginaCorrente++;
                stampaHeaderPagina(paginaCorrente);
                currentY = 32; // Resetta la Y alla prima riga utile sotto l'header
                colonna = 0;
            }

            disegnaCardProdotto(prod, x, currentY);

            // Gestione dell'avanzamento griglia (due colonne)
            if (colonna === 0) {
                colonna = 1; // Il prossimo va a destra
            } else {
                colonna = 0; // Torna a sinistra
                currentY += cardHeight + gapY; // Scendi alla riga successiva
            }
        };

        // Funzione per stampare i titoli delle sezioni nel catalogo
        const stampaTitoloSezione = (titolo) => {
            // Se eravamo a metà riga (colonna destra vuota), riallinea per il titolo a tutta pagina
            if (colonna === 1) {
                colonna = 0;
                currentY += cardHeight + gapY;
            }
            
            if (currentY + 15 > pageHeight - margin) {
                doc.addPage();
                paginaCorrente++;
                stampaHeaderPagina(paginaCorrente);
                currentY = 32;
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(0, 45, 98); // --dark-blue
            doc.text(titolo, margin, currentY);
            currentY += 8; // Spazio sotto il titolo della sezione
        };

        // --- 1. Sezione Generale "Novità In Evidenza" ---
        if (dataStruttura.novitaGenerali.length > 0) {
            stampaTitoloSezione("✨ NOVITÀ IN EVIDENZA");
            dataStruttura.novitaGenerali.forEach(prod => {
                inserisciCardNelFlusso(prod);
            });
        }

        // --- 2. Sezioni Divise Per Brand ---
        for (const brand in dataStruttura.strutturaBrand) {
            const prodottiBrand = dataStruttura.strutturaBrand[brand];
            if (prodottiBrand.length > 0) {
                stampaTitoloSezione(`BRAND: ${brand.toUpperCase()} »`);
                prodottiBrand.forEach(prod => {
                    inserisciCardNelFlusso(prod);
                });
            }
        }

        // Generazione del nome file e download
        const filename = `Catalogo_Sweets_A_Riquadri_${Date.now()}.pdf`;
        doc.save(filename);

        // Gestione dell'invio del messaggio d'appoggio per WhatsApp
        if (sendWhatsApp) {
            if (!this.currentUserPhone || this.currentUserPhone.trim() === "") {
                alert("Attenzione: nessun numero di cellulare associato a questo utente amministratore nel database delle credenziali.");
                return;
            }
            const cleanPhone = this.currentUserPhone.replace(/[^0-9+]/g, '');
            const message = encodeURIComponent(`Ciao! Ho appena generato il nuovo *Catalogo Sweets* a riquadri (esatta copia grafica del sito).\nFile di riferimento: ${filename}\n\nUsa il tasto allegati di WhatsApp per caricarmi il PDF appena scaricato.`);
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
            window.open(whatsappUrl, '_blank');
        }
    }
    

    // --- GESTIONE DATI TABELLA ADMIN ---
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
                <td><img src="${photoUrl}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" onerror="this.onerror=null;this.src=''"></td>
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
            alert('Inserisci un URL valido per la foto.');
            return;
        }
        
        const inputPrezzo = document.getElementById('prod-prezzo').value;
        const parsedPrezzo = parseFloat(inputPrezzo);

        if (isNaN(parsedPrezzo)) {
            alert('Inserisci un prezzo valido.');
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
        this.credentials = [{username: "admin", password: "password", cellulare: "+393331234567"}];
        this.products = [
            {id: "1", brand: "Frizz", nome: "Goleador Cola", descrizione: "Caramelle gommose frizzanti.", prezzo: 0.20, disponibile: "true", novita: "true", packtype: "monopezzo", type: "gommose", foto: ""},
            {id: "3", brand: "Chupa", nome: "Chupa Chups Fragola", descrizione: "Il lollipop più famoso.", prezzo: 0.50, disponibile: "true", novita: "true", packtype: "lollipop", type: "lollipop", foto: ""}
        ];
        this.renderAdminTable();
    }
}

const app = new CatalogApp();
