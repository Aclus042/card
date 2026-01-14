/* =====================================================
   NARRATIVE CARDS - WORLDBUILDING TOOL
   JavaScript Application
   ===================================================== */

// =====================================================
// DATA STORE
// =====================================================

class DataStore {
    constructor() {
        this.cards = [];
        this.navigationHistory = [];
    }

    generateId() {
        return 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    createCard(cardData) {
        const card = {
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...cardData
        };
        this.cards.push(card);
        return card;
    }

    updateCard(id, cardData) {
        const index = this.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            this.cards[index] = {
                ...this.cards[index],
                ...cardData,
                updatedAt: new Date().toISOString()
            };
            return this.cards[index];
        }
        return null;
    }

    deleteCard(id) {
        const index = this.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            // Remove references to this card from other cards
            this.cards.forEach(card => {
                if (card.adjacentLocations) {
                    card.adjacentLocations = card.adjacentLocations.filter(loc => loc !== id);
                }
                if (card.presentCharacters) {
                    card.presentCharacters = card.presentCharacters.filter(char => char !== id);
                }
                if (card.bonds) {
                    card.bonds = card.bonds.filter(bond => bond !== id);
                }
            });
            
            this.cards.splice(index, 1);
            return true;
        }
        return false;
    }

    getCard(id) {
        return this.cards.find(c => c.id === id);
    }

    getCardsByType(type) {
        return this.cards.filter(c => c.type === type);
    }

    getAllCards() {
        return this.cards;
    }

    searchCards(query) {
        const lowerQuery = query.toLowerCase();
        return this.cards.filter(card => 
            card.name.toLowerCase().includes(lowerQuery) ||
            (card.description && card.description.toLowerCase().includes(lowerQuery))
        );
    }

    pushToHistory(cardId) {
        this.navigationHistory.push(cardId);
        if (this.navigationHistory.length > 20) {
            this.navigationHistory.shift();
        }
    }

    getLastFromHistory() {
        return this.navigationHistory.pop();
    }
}

// =====================================================
// UI CONTROLLER
// =====================================================

class UIController {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.currentView = 'cards';
        this.currentCard = null;
        this.currentFilter = 'all';
        this.selectedType = null;
        this.editingCardId = null;
        
        // Carousel state
        this.carouselPositions = {
            eventos: 0,
            locais: 0,
            personagens: 0
        };
        
        // Drag state
        this.dragState = {
            isDragging: false,
            startX: 0,
            currentX: 0,
            track: null,
            startTranslate: 0
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderCardsList();
        this.updateWelcomeScreen();
        this.renderCarousels();
        this.initCarouselDrag();
    }

    bindEvents() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.showView(view);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Search input
        document.getElementById('search-cards').addEventListener('input', (e) => {
            this.filterCardsList(e.target.value);
        });

        // Type selection buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.selectType(type);
            });
        });

        // Form submission
        document.getElementById('card-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Connection selectors
        this.bindConnectionSelectors();

        // Modal overlay click to close
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeCardDetail();
            }
        });
    }
    
    initCarouselDrag() {
        const tracks = document.querySelectorAll('.carousel-track');
        
        tracks.forEach(track => {
            // Mouse events
            track.addEventListener('mousedown', (e) => this.startDrag(e, track));
            track.addEventListener('mousemove', (e) => this.onDrag(e));
            track.addEventListener('mouseup', () => this.endDrag());
            track.addEventListener('mouseleave', () => this.endDrag());
            
            // Touch events
            track.addEventListener('touchstart', (e) => this.startDrag(e, track), { passive: true });
            track.addEventListener('touchmove', (e) => this.onDrag(e), { passive: true });
            track.addEventListener('touchend', () => this.endDrag());
        });
    }
    
    startDrag(e, track) {
        this.dragState.isDragging = true;
        this.dragState.track = track;
        this.dragState.startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        
        // Get current translate value
        const transform = window.getComputedStyle(track).transform;
        if (transform !== 'none') {
            const matrix = new DOMMatrix(transform);
            this.dragState.startTranslate = matrix.m41;
        } else {
            this.dragState.startTranslate = 0;
        }
        
        track.classList.add('dragging');
    }
    
    onDrag(e) {
        if (!this.dragState.isDragging) return;
        
        const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const diff = currentX - this.dragState.startX;
        const newTranslate = this.dragState.startTranslate + diff;
        
        this.dragState.track.style.transform = `translateX(${newTranslate}px)`;
        this.dragState.currentX = currentX;
    }
    
    endDrag() {
        if (!this.dragState.isDragging) return;
        
        const track = this.dragState.track;
        track.classList.remove('dragging');
        
        const diff = this.dragState.currentX - this.dragState.startX;
        const cardWidth = 220 + 24; // card width + gap
        const threshold = 50;
        
        // Get carousel type from track
        const type = track.id.replace('track-', '');
        
        // Determine scroll direction based on drag
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Dragged right = go to previous
                scrollCarousel(type, -1);
            } else {
                // Dragged left = go to next
                scrollCarousel(type, 1);
            }
        } else {
            // Snap back to current position
            this.updateCarouselPosition(type);
        }
        
        this.dragState.isDragging = false;
        this.dragState.track = null;
    }
    
    updateCarouselPosition(type) {
        const track = document.getElementById(`track-${type}`);
        const cardWidth = 220 + 24;
        const position = this.carouselPositions[type];
        track.style.transform = `translateX(-${position * cardWidth}px)`;
    }
    
    renderCarousels() {
        const eventos = this.dataStore.getCardsByType('evento');
        const locais = this.dataStore.getCardsByType('local');
        const personagens = this.dataStore.getCardsByType('personagem');
        
        this.renderCarouselTrack('eventos', eventos, 'evento');
        this.renderCarouselTrack('locais', locais, 'local');
        this.renderCarouselTrack('personagens', personagens, 'personagem');
        
        // Show/hide empty states
        document.getElementById('empty-eventos').classList.toggle('visible', eventos.length === 0);
        document.getElementById('empty-locais').classList.toggle('visible', locais.length === 0);
        document.getElementById('empty-personagens').classList.toggle('visible', personagens.length === 0);
        
        // Hide track wrappers if empty
        document.querySelector('#carousel-eventos .carousel-track-wrapper').style.display = eventos.length > 0 ? 'block' : 'none';
        document.querySelector('#carousel-locais .carousel-track-wrapper').style.display = locais.length > 0 ? 'block' : 'none';
        document.querySelector('#carousel-personagens .carousel-track-wrapper').style.display = personagens.length > 0 ? 'block' : 'none';
    }
    
    renderCarouselTrack(trackId, cards, type) {
        const track = document.getElementById(`track-${trackId}`);
        
        if (cards.length === 0) {
            track.innerHTML = '';
            return;
        }
        
        track.innerHTML = cards.map(card => this.createFlipCard(card)).join('');
        
        // Reset position if needed
        if (this.carouselPositions[trackId] >= cards.length) {
            this.carouselPositions[trackId] = Math.max(0, cards.length - 1);
        }
        this.updateCarouselPosition(trackId);
    }
    
    createFlipCard(card) {
        const icon = this.getTypeIcon(card.type);
        const typeName = this.getTypeName(card.type);
        
        // Get meta info
        let metaHtml = '';
        if (card.type === 'personagem') {
            if (card.occupation) {
                metaHtml += `<span class="flip-card-meta-item">${this.escapeHtml(card.occupation)}</span>`;
            }
            if (card.age) {
                metaHtml += `<span class="flip-card-meta-item">${this.escapeHtml(card.age)}</span>`;
            }
        }
        
        // Build card back content based on whether there's an image
        let cardBackContent = '';
        const hasImage = card.image && card.image.length > 0;
        
        // Get image positions (handle legacy)
        let imagePositionX = 50;
        let imagePositionY = 50;
        
        if (card.imagePositionX !== undefined) {
            imagePositionX = card.imagePositionX ?? 50;
            imagePositionY = card.imagePositionY ?? 50;
        } else if (card.imagePosition !== undefined) {
            // Legacy: convert single position to Y
            if (typeof card.imagePosition === 'string') {
                if (card.imagePosition === 'top') imagePositionY = 0;
                else if (card.imagePosition === 'bottom') imagePositionY = 100;
                else imagePositionY = 50;
            } else {
                imagePositionY = card.imagePosition ?? 50;
            }
        }
        
        if (hasImage) {
            cardBackContent = `
                <div class="card-back-image">
                    <img src="${card.image}" alt="${this.escapeHtml(card.name)}" style="object-position: ${imagePositionX}% ${imagePositionY}%;">
                    <div class="card-back-image-overlay"></div>
                </div>
                <div class="card-back-info">
                    <span class="card-back-label">${this.escapeHtml(card.name)}</span>
                </div>
            `;
        } else {
            cardBackContent = `
                <span class="card-back-symbol">${icon}</span>
                <span class="card-back-label">${this.escapeHtml(card.name)}</span>
            `;
        }
        
        return `
            <div class="flip-card" data-card-id="${card.id}" onclick="toggleFlipCard(event, '${card.id}')">
                <div class="flip-card-inner">
                    <!-- Back of card (face down) -->
                    <div class="flip-card-front ${card.type}${hasImage ? ' has-image' : ''}">
                        ${cardBackContent}
                    </div>
                    
                    <!-- Front of card (face up - info) -->
                    <div class="flip-card-back ${card.type}">
                        <div class="flip-card-header ${card.type}">
                            <span class="flip-card-type ${card.type}">${icon} ${typeName}</span>
                            <h3 class="flip-card-title">${this.escapeHtml(card.name)}</h3>
                        </div>
                        <div class="flip-card-body">
                            <p class="flip-card-description">${this.escapeHtml(card.description) || 'Sem descrição'}</p>
                        </div>
                        ${metaHtml ? `<div class="flip-card-meta">${metaHtml}</div>` : ''}
                        <div class="flip-card-footer">
                            <button class="flip-card-action" onclick="openCardDetail(event, '${card.id}')">
                                Ver Detalhes →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindConnectionSelectors() {
        const selectors = [
            { select: 'adjacent-locations-select', container: 'selected-adjacent', type: 'local' },
            { select: 'present-characters-select', container: 'selected-characters', type: 'personagem' },
            { select: 'bonds-select', container: 'selected-bonds', type: 'personagem' }
        ];

        selectors.forEach(({ select, container }) => {
            const selectEl = document.getElementById(select);
            if (selectEl) {
                selectEl.addEventListener('change', (e) => {
                    const cardId = e.target.value;
                    if (cardId) {
                        this.addConnectionTag(cardId, container);
                        e.target.value = '';
                    }
                });
            }
        });
    }

    addConnectionTag(cardId, containerId) {
        const container = document.getElementById(containerId);
        const card = this.dataStore.getCard(cardId);
        
        if (!card) return;
        
        // Check if already added
        if (container.querySelector(`[data-card-id="${cardId}"]`)) return;

        const tag = document.createElement('div');
        tag.className = 'selected-connection';
        tag.dataset.cardId = cardId;
        tag.innerHTML = `
            <span>${card.name}</span>
            <button type="button" class="remove-connection" onclick="ui.removeConnectionTag('${cardId}', '${containerId}')">×</button>
        `;
        container.appendChild(tag);
    }

    removeConnectionTag(cardId, containerId) {
        const container = document.getElementById(containerId);
        const tag = container.querySelector(`[data-card-id="${cardId}"]`);
        if (tag) {
            tag.remove();
        }
    }

    getSelectedConnections(containerId) {
        const container = document.getElementById(containerId);
        return Array.from(container.querySelectorAll('.selected-connection')).map(
            tag => tag.dataset.cardId
        );
    }

    showView(view) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');

        this.currentView = view;

        if (view === 'cards') {
            if (!this.currentCard) {
                this.updateWelcomeScreen();
            }
        } else if (view === 'create' && !this.editingCardId) {
            // Only reset form if not editing
            this.resetForm();
        }

        // Update breadcrumb
        this.updateBreadcrumb();
        
        // Close mobile menu if open
        closeMobileMenu();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderCardsList();
    }

    filterCardsList(query) {
        const cards = query ? this.dataStore.searchCards(query) : this.dataStore.getAllCards();
        this.renderCardsList(cards);
    }

    renderCardsList(cards = null) {
        const list = document.getElementById('cards-list');
        let filteredCards = cards || this.dataStore.getAllCards();

        if (this.currentFilter !== 'all') {
            filteredCards = filteredCards.filter(c => c.type === this.currentFilter);
        }

        // Sort by type (evento, local, personagem) then by name
        const typeOrder = { 'evento': 0, 'local': 1, 'personagem': 2 };
        filteredCards.sort((a, b) => {
            const typeCompare = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
            if (typeCompare !== 0) return typeCompare;
            return a.name.localeCompare(b.name);
        });

        if (filteredCards.length === 0) {
            list.innerHTML = `
                <li class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>Nenhum card encontrado</p>
                </li>
            `;
            return;
        }

        list.innerHTML = filteredCards.map(card => `
            <li class="card-list-item ${this.currentCard && this.currentCard.id === card.id ? 'active' : ''}" 
                onclick="ui.openCard('${card.id}')">
                <span class="type-dot ${card.type}"></span>
                <span class="card-name">${this.escapeHtml(card.name)}</span>
            </li>
        `).join('');
    }

    updateWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcome-screen');
        const carouselContainer = document.getElementById('carousel-container');
        
        const hasCards = this.dataStore.getAllCards().length > 0;
        
        if (hasCards) {
            welcomeScreen.style.display = 'none';
            carouselContainer.classList.add('active');
            this.renderCarousels();
        } else {
            welcomeScreen.style.display = 'flex';
            carouselContainer.classList.remove('active');
        }
    }

    openCard(cardId, animation = 'default') {
        const card = this.dataStore.getCard(cardId);
        if (!card) return;

        // Push current card to history before navigating
        if (this.currentCard) {
            this.dataStore.pushToHistory(this.currentCard.id);
        }

        this.currentCard = card;
        this.showView('cards');
        this.renderCardDetail(card);
        this.renderCardsList();
        this.updateBreadcrumb();
        
        // Close mobile menu if open
        closeMobileMenu();
    }

    renderCardDetail(card) {
        const overlay = document.getElementById('card-detail-overlay');
        const container = document.getElementById('card-detail-container');

        let html = `
            <button class="card-detail-close" onclick="closeCardDetail()">×</button>
            <div class="narrative-card">
                <div class="card-header ${card.type}">
                    <span class="card-type-badge ${card.type}">
                        ${this.getTypeIcon(card.type)} ${this.getTypeName(card.type)}
                    </span>
                    <h1 class="card-title">${this.escapeHtml(card.name)}</h1>
                    <div class="card-actions">
                        <button class="card-action-btn" onclick="ui.editCard('${card.id}')" title="Editar">
                            ✎
                        </button>
                        <button class="card-action-btn delete" onclick="ui.confirmDeleteCard('${card.id}')" title="Excluir">
                            🗑
                        </button>
                    </div>
                </div>
                <div class="card-body">
        `;

        // Render type-specific content
        if (card.type === 'personagem') {
            html += this.renderCharacterContent(card);
        } else if (card.type === 'local') {
            html += this.renderLocationContent(card);
        } else if (card.type === 'evento') {
            html += this.renderEventContent(card);
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
        overlay.classList.add('active');
    }

    renderCard(card, animation = 'default') {
        // Now renders to detail overlay
        this.renderCardDetail(card);
    }

    renderEventContent(card) {
        let html = '';

        if (card.description) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">O que acontece</h3>
                    <div class="card-section-content">${this.formatText(card.description)}</div>
                </div>
            `;
        }

        if (card.consequences) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Consequências Narrativas</h3>
                    <div class="card-section-content">${this.formatText(card.consequences)}</div>
                </div>
            `;
        }

        if (card.hooks) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Possíveis Ganchos</h3>
                    <div class="card-section-content">${this.formatText(card.hooks)}</div>
                </div>
            `;
        }

        return html;
    }

    renderLocationContent(card) {
        let html = '';

        if (card.description) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Descrição</h3>
                    <div class="card-section-content">${this.formatText(card.description)}</div>
                </div>
            `;
        }

        // Adjacent Locations
        if (card.adjacentLocations && card.adjacentLocations.length > 0) {
            const locations = card.adjacentLocations
                .map(id => this.dataStore.getCard(id))
                .filter(c => c);

            if (locations.length > 0) {
                html += `
                    <div class="connections-section">
                        <h3 class="connections-title">
                            🏛 Locais Adjacentes
                        </h3>
                        <div class="connections-list">
                            ${locations.map(loc => `
                                <span class="connection-tag local" onclick="ui.openCard('${loc.id}', 'left')">
                                    <span class="connection-icon">→</span>
                                    ${this.escapeHtml(loc.name)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Present Characters
        if (card.presentCharacters && card.presentCharacters.length > 0) {
            const characters = card.presentCharacters
                .map(id => this.dataStore.getCard(id))
                .filter(c => c);

            if (characters.length > 0) {
                html += `
                    <div class="connections-section">
                        <h3 class="connections-title">
                            👤 Personagens Presentes
                        </h3>
                        <div class="connections-list">
                            ${characters.map(char => `
                                <span class="connection-tag personagem" onclick="ui.openCard('${char.id}', 'left')">
                                    <span class="connection-icon">→</span>
                                    ${this.escapeHtml(char.name)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        return html;
    }

    renderCharacterContent(card) {
        let html = '';

        // Meta info
        if (card.occupation || card.age) {
            html += `<div class="card-meta">`;
            if (card.occupation) {
                html += `
                    <div class="meta-item">
                        <span class="meta-label">Ocupação</span>
                        <span class="meta-value">${this.escapeHtml(card.occupation)}</span>
                    </div>
                `;
            }
            if (card.age) {
                html += `
                    <div class="meta-item">
                        <span class="meta-label">Idade</span>
                        <span class="meta-value">${this.escapeHtml(card.age)}</span>
                    </div>
                `;
            }
            html += `</div>`;
        }

        if (card.description) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Descrição</h3>
                    <div class="card-section-content">${this.formatText(card.description)}</div>
                </div>
            `;
        }

        if (card.appearance) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Aparência</h3>
                    <div class="card-section-content">${this.formatText(card.appearance)}</div>
                </div>
            `;
        }

        if (card.personality) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Personalidade</h3>
                    <div class="card-section-content">${this.formatText(card.personality)}</div>
                </div>
            `;
        }

        if (card.history) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">História</h3>
                    <div class="card-section-content">${this.formatText(card.history)}</div>
                </div>
            `;
        }

        if (card.secrets) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Segredos ou Motivações</h3>
                    <div class="card-section-content">${this.formatText(card.secrets)}</div>
                </div>
            `;
        }

        // Bonds
        if (card.bonds && card.bonds.length > 0) {
            const bondCards = card.bonds
                .map(id => this.dataStore.getCard(id))
                .filter(c => c);

            if (bondCards.length > 0) {
                html += `
                    <div class="connections-section">
                        <h3 class="connections-title">
                            🔗 Vínculos
                        </h3>
                        <div class="connections-list">
                            ${bondCards.map(bond => `
                                <span class="connection-tag personagem" onclick="ui.openCard('${bond.id}', 'left')">
                                    <span class="connection-icon">→</span>
                                    ${this.escapeHtml(bond.name)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        return html;
    }

    selectType(type) {
        this.selectedType = type;

        // Update type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Show common fields
        document.getElementById('common-fields').style.display = 'block';
        document.getElementById('form-actions').style.display = 'flex';

        // Hide all type-specific fields
        document.querySelectorAll('.type-fields').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected type fields
        document.getElementById(`${type}-fields`).style.display = 'block';

        // Populate connection selectors
        this.populateConnectionSelectors();
    }

    populateConnectionSelectors() {
        // Adjacent locations (only other locations)
        const adjacentSelect = document.getElementById('adjacent-locations-select');
        if (adjacentSelect) {
            const locations = this.dataStore.getCardsByType('local')
                .filter(c => !this.editingCardId || c.id !== this.editingCardId);
            adjacentSelect.innerHTML = `
                <option value="">+ Adicionar local adjacente...</option>
                ${locations.map(loc => `
                    <option value="${loc.id}">${this.escapeHtml(loc.name)}</option>
                `).join('')}
            `;
        }

        // Present characters
        const charactersSelect = document.getElementById('present-characters-select');
        if (charactersSelect) {
            const characters = this.dataStore.getCardsByType('personagem');
            charactersSelect.innerHTML = `
                <option value="">+ Adicionar personagem...</option>
                ${characters.map(char => `
                    <option value="${char.id}">${this.escapeHtml(char.name)}</option>
                `).join('')}
            `;
        }

        // Bonds
        const bondsSelect = document.getElementById('bonds-select');
        if (bondsSelect) {
            const characters = this.dataStore.getCardsByType('personagem')
                .filter(c => !this.editingCardId || c.id !== this.editingCardId);
            bondsSelect.innerHTML = `
                <option value="">+ Adicionar vínculo...</option>
                ${characters.map(char => `
                    <option value="${char.id}">${this.escapeHtml(char.name)}</option>
                `).join('')}
            `;
        }
    }

    handleFormSubmit() {
        const name = document.getElementById('card-name').value.trim();
        
        if (!this.selectedType) {
            this.showToast('Selecione um tipo de card', 'error');
            return;
        }

        if (!name) {
            this.showToast('Digite um nome para o card', 'error');
            return;
        }

        // Get image data
        const imageData = getCardImageData();

        const cardData = {
            type: this.selectedType,
            name: name,
            description: document.getElementById('card-description').value.trim(),
            image: imageData.image,
            imagePositionX: imageData.imagePositionX,
            imagePositionY: imageData.imagePositionY
        };

        // Type-specific fields
        if (this.selectedType === 'evento') {
            cardData.consequences = document.getElementById('evento-consequences').value.trim();
            cardData.hooks = document.getElementById('evento-hooks').value.trim();
        } else if (this.selectedType === 'local') {
            cardData.adjacentLocations = this.getSelectedConnections('selected-adjacent');
            cardData.presentCharacters = this.getSelectedConnections('selected-characters');
        } else if (this.selectedType === 'personagem') {
            cardData.occupation = document.getElementById('personagem-occupation').value.trim();
            cardData.age = document.getElementById('personagem-age').value.trim();
            cardData.appearance = document.getElementById('personagem-appearance').value.trim();
            cardData.personality = document.getElementById('personagem-personality').value.trim();
            cardData.history = document.getElementById('personagem-history').value.trim();
            cardData.secrets = document.getElementById('personagem-secrets').value.trim();
            cardData.bonds = this.getSelectedConnections('selected-bonds');
        }

        let card;
        if (this.editingCardId) {
            card = this.dataStore.updateCard(this.editingCardId, cardData);
            this.showToast('Card atualizado com sucesso!', 'success');
        } else {
            card = this.dataStore.createCard(cardData);
            this.showToast('Card criado com sucesso!', 'success');
        }

        this.renderCardsList();
        this.renderCarousels();
        this.showView('cards');
        this.updateWelcomeScreen();
        this.resetForm();
    }

    editCard(cardId) {
        const card = this.dataStore.getCard(cardId);
        if (!card) return;

        this.editingCardId = cardId;
        this.showView('create');

        // Update form title
        document.getElementById('form-title').textContent = 'Editar Card';
        document.getElementById('submit-text').textContent = 'Salvar Alterações';

        // Set type
        this.selectType(card.type);

        // Populate common fields
        document.getElementById('card-name').value = card.name || '';
        document.getElementById('card-description').value = card.description || '';
        
        // Load image data (handle legacy single position)
        if (card.imagePositionX !== undefined) {
            setCardImageData(card.image, card.imagePositionX, card.imagePositionY);
        } else {
            // Legacy: imagePosition was single value for Y
            setCardImageData(card.image, card.imagePosition);
        }

        // Populate type-specific fields
        if (card.type === 'evento') {
            document.getElementById('evento-consequences').value = card.consequences || '';
            document.getElementById('evento-hooks').value = card.hooks || '';
        } else if (card.type === 'local') {
            // Clear and repopulate connections
            document.getElementById('selected-adjacent').innerHTML = '';
            document.getElementById('selected-characters').innerHTML = '';
            
            if (card.adjacentLocations) {
                card.adjacentLocations.forEach(id => {
                    this.addConnectionTag(id, 'selected-adjacent');
                });
            }
            if (card.presentCharacters) {
                card.presentCharacters.forEach(id => {
                    this.addConnectionTag(id, 'selected-characters');
                });
            }
        } else if (card.type === 'personagem') {
            document.getElementById('personagem-occupation').value = card.occupation || '';
            document.getElementById('personagem-age').value = card.age || '';
            document.getElementById('personagem-appearance').value = card.appearance || '';
            document.getElementById('personagem-personality').value = card.personality || '';
            document.getElementById('personagem-history').value = card.history || '';
            document.getElementById('personagem-secrets').value = card.secrets || '';
            
            // Clear and repopulate bonds
            document.getElementById('selected-bonds').innerHTML = '';
            if (card.bonds) {
                card.bonds.forEach(id => {
                    this.addConnectionTag(id, 'selected-bonds');
                });
            }
        }
    }

    confirmDeleteCard(cardId) {
        const card = this.dataStore.getCard(cardId);
        if (!card) return;

        const confirmed = confirm(`Tem certeza que deseja excluir "${card.name}"?\n\nEsta ação não pode ser desfeita.`);
        
        if (confirmed) {
            this.dataStore.deleteCard(cardId);
            this.showToast('Card excluído', 'info');
            this.currentCard = null;
            closeCardDetail();
            this.renderCardsList();
            this.renderCarousels();
            this.updateWelcomeScreen();
            this.updateBreadcrumb();
        }
    }

    resetForm() {
        this.editingCardId = null;
        this.selectedType = null;

        document.getElementById('form-title').textContent = 'Criar Novo Card';
        document.getElementById('submit-text').textContent = 'Criar Card';

        // Reset type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Hide fields
        document.getElementById('common-fields').style.display = 'none';
        document.getElementById('form-actions').style.display = 'none';
        document.querySelectorAll('.type-fields').forEach(el => {
            el.style.display = 'none';
        });

        // Clear all inputs
        document.getElementById('card-form').reset();

        // Clear image data
        clearCardImageData();

        // Clear connection containers
        document.getElementById('selected-adjacent').innerHTML = '';
        document.getElementById('selected-characters').innerHTML = '';
        document.getElementById('selected-bonds').innerHTML = '';
    }

    updateBreadcrumb() {
        // Breadcrumb removed - function kept for compatibility
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ';
        if (type === 'success') icon = '✓';
        else if (type === 'error') icon = '✕';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }

    getTypeIcon(type) {
        const icons = {
            evento: '⚡',
            local: '🏛',
            personagem: '👤'
        };
        return icons[type] || '◇';
    }

    getTypeName(type) {
        const names = {
            evento: 'Evento',
            local: 'Local',
            personagem: 'Personagem'
        };
        return names[type] || type;
    }

    formatText(text) {
        if (!text) return '';
        return text.split('\n').map(line => 
            `<p>${this.escapeHtml(line) || '&nbsp;'}</p>`
        ).join('');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// =====================================================
// GLOBAL FUNCTIONS
// =====================================================

let dataStore;
let ui;

function initApp() {
    dataStore = new DataStore();
    ui = new UIController(dataStore);
    initImageUpload();
}

function showView(view) {
    ui.showView(view);
}

function goHome() {
    ui.currentCard = null;
    ui.showView('cards');
    ui.updateWelcomeScreen();
    ui.updateBreadcrumb();
}

function resetForm() {
    ui.resetForm();
    ui.showView('cards');
}

// Mobile menu functions
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    
    // Update button icon
    if (sidebar.classList.contains('open')) {
        toggle.textContent = '✕';
    } else {
        toggle.textContent = '☰';
    }
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    toggle.textContent = '☰';
}

// Carousel functions
function scrollCarousel(type, direction) {
    const track = document.getElementById(`track-${type}`);
    const cards = track.querySelectorAll('.flip-card');
    
    if (cards.length === 0) return;
    
    const cardWidth = 220 + 24; // card width + gap
    const visibleCards = Math.floor(track.parentElement.offsetWidth / cardWidth) || 1;
    const maxPosition = Math.max(0, cards.length - visibleCards);
    
    let newPosition = ui.carouselPositions[type] + direction;
    newPosition = Math.max(0, Math.min(newPosition, maxPosition));
    
    ui.carouselPositions[type] = newPosition;
    track.style.transform = `translateX(-${newPosition * cardWidth}px)`;
}

function toggleFlipCard(event, cardId) {
    // Don't flip if clicking action button
    if (event.target.closest('.flip-card-action')) return;
    
    // Don't flip if dragging
    if (ui.dragState.isDragging) return;
    
    const card = document.querySelector(`.flip-card[data-card-id="${cardId}"]`);
    if (card) {
        card.classList.toggle('flipped');
    }
}

function openCardDetail(event, cardId) {
    event.stopPropagation();
    ui.openCard(cardId);
}

function closeCardDetail(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const overlay = document.getElementById('card-detail-overlay');
    overlay.classList.remove('active');
    ui.currentCard = null;
    ui.updateBreadcrumb();
}

function selectTypeFromCarousel(type) {
    // Small delay to let the view change first
    setTimeout(() => {
        ui.selectType(type);
    }, 100);
}

function exportCards() {
    const cards = dataStore.getAllCards();
    
    if (cards.length === 0) {
        ui.showToast('Nenhum card para exportar', 'error');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        cards: cards
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `narrative-cards-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ui.showToast(`${cards.length} cards exportados com sucesso!`, 'success');
}

function importCards(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.cards || !Array.isArray(data.cards)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            const existingIds = dataStore.getAllCards().map(c => c.id);
            let imported = 0;
            let skipped = 0;
            
            // Create a mapping for old IDs to new IDs
            const idMapping = {};
            
            // First pass: create all cards with new IDs
            data.cards.forEach(card => {
                const oldId = card.id;
                const newId = dataStore.generateId();
                idMapping[oldId] = newId;
            });
            
            // Second pass: import cards with updated references
            data.cards.forEach(card => {
                const newCard = { ...card };
                newCard.id = idMapping[card.id];
                
                // Update connection references
                if (newCard.adjacentLocations) {
                    newCard.adjacentLocations = newCard.adjacentLocations
                        .map(id => idMapping[id] || id)
                        .filter(id => id);
                }
                if (newCard.presentCharacters) {
                    newCard.presentCharacters = newCard.presentCharacters
                        .map(id => idMapping[id] || id)
                        .filter(id => id);
                }
                if (newCard.bonds) {
                    newCard.bonds = newCard.bonds
                        .map(id => idMapping[id] || id)
                        .filter(id => id);
                }
                
                newCard.createdAt = new Date().toISOString();
                newCard.updatedAt = new Date().toISOString();
                
                dataStore.cards.push(newCard);
                imported++;
            });
            
            ui.renderCardsList();
            ui.renderCarousels();
            ui.updateWelcomeScreen();
            
            ui.showToast(`${imported} cards importados com sucesso!`, 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            ui.showToast('Erro ao importar: arquivo inválido', 'error');
        }
    };
    
    reader.onerror = function() {
        ui.showToast('Erro ao ler o arquivo', 'error');
    };
    
    reader.readAsText(file);
    
    // Reset input so the same file can be selected again
    event.target.value = '';
}

// =====================================================
// IMAGE UPLOAD FUNCTIONS
// =====================================================

let currentCardImage = null;
let currentImagePositionX = 50; // Percentage (0-100), 50 = center
let currentImagePositionY = 50; // Percentage (0-100), 50 = center

// Drag state for image positioning
let imageDragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startPositionX: 50,
    startPositionY: 50
};

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        ui.showToast('Por favor, selecione um arquivo de imagem', 'error');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        ui.showToast('A imagem deve ter no máximo 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentCardImage = e.target.result;
        currentImagePositionX = 50; // Reset to center for new image
        currentImagePositionY = 50;
        showImagePreview(currentCardImage);
    };
    reader.readAsDataURL(file);
}

function showImagePreview(imageSrc) {
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const placeholder = document.getElementById('image-placeholder');
    const removeBtn = document.getElementById('remove-image-btn');
    const positionControls = document.getElementById('image-position-controls');
    const nameBar = document.getElementById('preview-name-bar');
    
    previewImg.src = imageSrc;
    previewImg.style.display = 'block';
    previewImg.style.objectPosition = `${currentImagePositionX}% ${currentImagePositionY}%`;
    placeholder.style.display = 'none';
    removeBtn.style.display = 'flex';
    positionControls.style.display = 'block';
    nameBar.style.display = 'flex';
    preview.classList.add('has-image');
    
    // Update name in preview
    updatePreviewName();
}

function hideImagePreview() {
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const placeholder = document.getElementById('image-placeholder');
    const removeBtn = document.getElementById('remove-image-btn');
    const positionControls = document.getElementById('image-position-controls');
    const nameBar = document.getElementById('preview-name-bar');
    
    previewImg.src = '';
    previewImg.style.display = 'none';
    previewImg.style.objectPosition = '';
    placeholder.style.display = 'flex';
    removeBtn.style.display = 'none';
    positionControls.style.display = 'none';
    nameBar.style.display = 'none';
    preview.classList.remove('has-image');
}

function removeCardImage() {
    currentCardImage = null;
    currentImagePositionX = 50;
    currentImagePositionY = 50;
    hideImagePreview();
    document.getElementById('card-image').value = '';
}

function initImageUpload() {
    const preview = document.getElementById('image-preview');
    const fileInput = document.getElementById('card-image');
    const previewImg = document.getElementById('preview-img');
    const nameInput = document.getElementById('card-name');
    
    // Click on preview to trigger file upload (only when no image)
    preview.addEventListener('click', (e) => {
        // Don't trigger if clicking on remove button or if dragging
        if (e.target.id === 'remove-image-btn' || e.target.closest('#remove-image-btn')) {
            return;
        }
        // Only open file picker if no image yet
        if (!preview.classList.contains('has-image')) {
            fileInput.click();
        }
    });
    
    // Double click to change image
    preview.addEventListener('dblclick', (e) => {
        if (e.target.id === 'remove-image-btn' || e.target.closest('#remove-image-btn')) {
            return;
        }
        fileInput.click();
    });
    
    // Mouse drag for positioning
    preview.addEventListener('mousedown', (e) => startImageDrag(e, preview));
    document.addEventListener('mousemove', (e) => onImageDrag(e));
    document.addEventListener('mouseup', () => endImageDrag());
    
    // Touch drag for positioning
    preview.addEventListener('touchstart', (e) => startImageDrag(e, preview), { passive: false });
    document.addEventListener('touchmove', (e) => onImageDrag(e), { passive: false });
    document.addEventListener('touchend', () => endImageDrag());
    
    // Update preview name when typing
    nameInput.addEventListener('input', updatePreviewName);
}

function updatePreviewName() {
    const nameInput = document.getElementById('card-name');
    const previewName = document.getElementById('preview-card-name');
    const name = nameInput.value.trim();
    previewName.textContent = name || 'Nome do Card';
}

function startImageDrag(e, preview) {
    // Only start drag if there's an image
    if (!preview.classList.contains('has-image')) return;
    
    // Don't start drag on remove button
    if (e.target.id === 'remove-image-btn' || e.target.closest('#remove-image-btn')) {
        return;
    }
    
    e.preventDefault();
    
    imageDragState.isDragging = true;
    imageDragState.startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    imageDragState.startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    imageDragState.startPositionX = currentImagePositionX;
    imageDragState.startPositionY = currentImagePositionY;
    
    preview.classList.add('dragging');
}

function onImageDrag(e) {
    if (!imageDragState.isDragging) return;
    
    e.preventDefault();
    
    const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    
    const diffX = imageDragState.startX - currentX; // Inverted: drag left = show right part
    const diffY = imageDragState.startY - currentY; // Inverted: drag up = show lower part
    
    // Calculate new position (sensitivity based on preview size)
    const preview = document.getElementById('image-preview');
    const sensitivityX = 150 / preview.offsetWidth;
    const sensitivityY = 150 / preview.offsetHeight;
    
    let newPositionX = imageDragState.startPositionX + (diffX * sensitivityX);
    let newPositionY = imageDragState.startPositionY + (diffY * sensitivityY);
    
    // Clamp between 0 and 100
    newPositionX = Math.max(0, Math.min(100, newPositionX));
    newPositionY = Math.max(0, Math.min(100, newPositionY));
    
    currentImagePositionX = newPositionX;
    currentImagePositionY = newPositionY;
    
    // Update preview
    const previewImg = document.getElementById('preview-img');
    previewImg.style.objectPosition = `${currentImagePositionX}% ${currentImagePositionY}%`;
}

function endImageDrag() {
    if (!imageDragState.isDragging) return;
    
    imageDragState.isDragging = false;
    
    const preview = document.getElementById('image-preview');
    preview.classList.remove('dragging');
}

function getCardImageData() {
    return {
        image: currentCardImage,
        imagePositionX: currentImagePositionX,
        imagePositionY: currentImagePositionY
    };
}

function setCardImageData(image, positionX, positionY) {
    currentCardImage = image || null;
    
    // Handle legacy single position (convert to X=50, Y=position)
    if (positionY === undefined && positionX !== undefined) {
        // Legacy: positionX is actually the old single position (Y)
        if (typeof positionX === 'string') {
            if (positionX === 'top') currentImagePositionY = 0;
            else if (positionX === 'bottom') currentImagePositionY = 100;
            else currentImagePositionY = 50;
        } else {
            currentImagePositionY = positionX ?? 50;
        }
        currentImagePositionX = 50;
    } else {
        currentImagePositionX = positionX ?? 50;
        currentImagePositionY = positionY ?? 50;
    }
    
    if (currentCardImage) {
        showImagePreview(currentCardImage);
    } else {
        hideImagePreview();
    }
}

function clearCardImageData() {
    currentCardImage = null;
    currentImagePositionX = 50;
    currentImagePositionY = 50;
    hideImagePreview();
    document.getElementById('card-image').value = '';
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
