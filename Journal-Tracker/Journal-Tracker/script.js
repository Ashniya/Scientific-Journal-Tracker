document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Theme management
    const currentTheme = localStorage.getItem('theme') || 'light';
    body.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        themeToggle.innerHTML = theme === 'dark' 
            ? '<i class="fas fa-moon"></i>' 
            : '<i class="fas fa-sun"></i>';
    }

    // In a production environment, this should be handled server-side
    // This is just for demo purposes
    const OPENAI_API_KEY = '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'; // Replace with your API key
    
    // List of scientific disciplines for validation
    const scientificDisciplines = [
        'biology', 'chemistry', 'physics', 'medicine', 'engineering', 'computer science', 
        'astronomy', 'geology', 'mathematics', 'neuroscience', 'psychology', 'ecology',
        'genetics', 'biochemistry', 'microbiology', 'pharmacology', 'agriculture', 'botany',
        'zoology', 'oceanography', 'meteorology', 'geography', 'anthropology', 'archaeology',
        'materials science', 'nanoscience', 'artificial intelligence', 'machine learning',
        'robotics', 'climate', 'energy', 'sustainability', 'conservation', 'nutrition',
        'epidemiology', 'virology', 'immunology', 'biotechnology', 'bioinformatics',
        'quantum', 'nuclear', 'solar', 'renewable', 'cognitive', 'clinical', 'social',
        'cloud computing', 'neural', 'genomics', 'proteomics', 'evolution', 'molecular',
        'cellular', 'developmental', 'environmental', 'computational', 'theoretical',
        'applied', 'experimental', 'organic', 'inorganic', 'physical', 'analytical',
        'thermodynamics', 'mechanics', 'electronics', 'optics', 'acoustics', 'fluid dynamics',
        'statistics', 'calculus', 'geometry', 'topology', 'algebra', 'number theory',
        'cosmology', 'astrophysics', 'particle', 'plasma', 'condensed matter', 'relativity',
        'research', 'science', 'scientific', 'journal', 'study', 'papers', 'publications',
        'experiment', 'theory', 'lab', 'laboratory', 'method', 'technology', 'innovation',
        'discovery', 'breakthrough', 'findings', 'data', 'analysis', 'review', 'meta-analysis'
    ];
    
    // Add animation class to container on load
    document.querySelector('.container').classList.add('fade-in');
    
    // Check if query is scientific in nature
    function isScientificQuery(query) {
        const normalizedQuery = query.toLowerCase();
        return scientificDisciplines.some(term => normalizedQuery.includes(term));
    }
    
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = userInput.value.trim();
        if (!query) return;
        
        // Add user message to chat
        addMessage('user', query);
        
        // Clear input field
        userInput.value = '';
        
        // Add loading indicator
        const loadingId = addMessage('bot', '<div class="loading">Processing your query</div>');
        
        try {
            // Check if the query is scientific in nature
            if (!isScientificQuery(query)) {
                removeMessage(loadingId);
                addMessage('bot', `<div>
                    <i class="fas fa-info-circle"></i> I'm a Scientific Journal Tracker designed to help with academic research queries.
                    <p>Please ask me about scientific topics, research papers, or scholarly articles. For example:</p>
                    <ul style="margin-top: 10px; margin-left: 20px;">
                        <li>"Find recent papers on quantum computing"</li>
                        <li>"What are the latest studies on climate change?"</li>
                        <li>"Show me research about machine learning in healthcare"</li>
                    </ul>
                </div>`);
                return;
            }
            
            // First try CrossRef API
            const articles = await searchCrossRef(query);
            
            if (articles && articles.length > 0) {
                const relevantArticles = validateArticleRelevance(articles, query);
                removeMessage(loadingId);
                
                if (relevantArticles.length > 0) {
                    displayArticles(relevantArticles);
                } else {
                    // Fallback to OpenAI if no relevant articles
                    await fallbackToOpenAI(query);
                }
            } else {
                // Fallback to OpenAI if no CrossRef results
                removeMessage(loadingId);
                await fallbackToOpenAI(query);
            }
        } catch (error) {
            console.error('Error:', error);
            removeMessage(loadingId);
            addMessage('bot', `<div class="error">
                <i class="fas fa-exclamation-circle"></i> Sorry, I couldn't retrieve any results. Please try again later.
            </div>`);
        }
    });
    
    async function searchCrossRef(query) {
        try {
            // Construct the CrossRef API URL with proper parameters and filters
            const encodedQuery = encodeURIComponent(query);
            // Adding filter for article type and sorting by relevance score
            const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=10&sort=score&order=desc&filter=type:journal-article`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.message && data.message.items && data.message.items.length > 0) {
                // Format and return article data
                return data.message.items.map(item => ({
                    title: item.title ? item.title[0] : 'Untitled',
                    doi: item.DOI,
                    author: item.author ? formatAuthors(item.author) : 'Unknown',
                    published: item.published ? formatDate(item.published) : 'Unknown date',
                    journal: item['container-title'] ? item['container-title'][0] : 'Unknown journal',
                    abstract: item.abstract || '',
                    score: item.score || 0
                }));
            }
            
            return [];
        } catch (error) {
            console.error('CrossRef API error:', error);
            return [];
        }
    }
    
    // Function to validate article relevance to the search query
    function validateArticleRelevance(articles, query) {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);
        
        return articles.filter(article => {
            // Check if title or abstract contains query terms
            const titleText = article.title.toLowerCase();
            const abstractText = article.abstract ? article.abstract.toLowerCase() : '';
            const journalText = article.journal.toLowerCase();
            
            // Count matches of query terms in title and abstract
            let relevanceScore = 0;
            
            queryTerms.forEach(term => {
                if (titleText.includes(term)) relevanceScore += 2;
                if (abstractText.includes(term)) relevanceScore += 1;
                if (journalText.includes(term)) relevanceScore += 1;
            });
            
            // Article is relevant if it has at least some query terms or a high CrossRef score
            return relevanceScore > 0 || article.score > 50;
        }).slice(0, 3); // Return top 3 relevant articles
    }
    
    function formatAuthors(authors) {
        if (!authors || !authors.length) return 'Unknown';
        
        // Get the first author's name
        const firstAuthor = authors[0];
        const authorName = firstAuthor.given && firstAuthor.family 
            ? `${firstAuthor.given} ${firstAuthor.family}`
            : firstAuthor.name || 'Unknown';
            
        // Add "et al." if there are more authors
        return authors.length > 1 ? `${authorName} et al.` : authorName;
    }
    
    function formatDate(publishedDate) {
        if (!publishedDate) return 'Unknown date';
        
        try {
            // Handle array of date parts
            if (Array.isArray(publishedDate['date-parts']) && publishedDate['date-parts'][0]) {
                const dateParts = publishedDate['date-parts'][0];
                if (dateParts.length >= 3) {
                    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString();
                } else if (dateParts.length >= 1) {
                    return dateParts[0].toString(); // Just the year
                }
            }
            return 'Unknown date';
        } catch (e) {
            return 'Unknown date';
        }
    }
    
    async function fallbackToOpenAI(query) {
        try {
            const openaiResponse = await fetchOpenAIResponse(query);
            addMessage('bot', openaiResponse);
        } catch (error) {
            console.error('OpenAI API error:', error);
            addMessage('bot', `<div class="error">
                <i class="fas fa-exclamation-triangle"></i> I couldn't generate research suggestions at this time.
            </div>`);
        }
    }
    
    async function fetchOpenAIResponse(query) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a scholarly research assistant that suggests scientific journal articles. 
                            The user is looking for papers on: "${query}".
                            Provide 3 specific, real, and relevant journal articles on this topic.
                            Include title, authors (with et al. for multiple), journal name, and year.
                            Format your response with proper HTML for a chat interface.
                            Use div class="article-item" for each article.`
                        },
                        {
                            role: 'user',
                            content: `Find me relevant scholarly articles about: ${query}`
                        }
                    ],
                    max_tokens: 500
                })
            });
            
            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                // Parse the OpenAI response
                let content = data.choices[0].message.content;
                
                // If response doesn't already have HTML formatting, add it
                if (!content.includes('class="article-item"')) {
                    content = '<div class="article-list">' + 
                        content
                            .split(/\n\n|\n(?=\d+\.)/)
                            .filter(text => text.trim())
                            .map(article => `<div class="article-item">${article}</div>`)
                            .join('') + 
                        '</div>';
                }
                
                return content;
            } else {
                throw new Error('Invalid response from OpenAI');
            }
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            throw error;
        }
    }
    
    function displayArticles(articles) {
        let html = `<div><i class="fas fa-check-circle"></i> Here are some relevant journal articles:</div><div class="article-list">`;
        
        articles.forEach((article, index) => {
            html += `
                <div class="article-item">
                    <strong>${index + 1}. ${article.title}</strong><br>
                    <i class="fas fa-user-edit"></i> ${article.author}<br>
                    <i class="fas fa-book-open"></i> ${article.journal}, ${article.published}<br>
                    <a href="https://doi.org/${article.doi}" class="article-link" target="_blank">
                        <i class="fas fa-external-link-alt"></i> View Article (DOI: ${article.doi})
                    </a>
                </div>
            `;
        });
        
        html += '</div>';
        addMessage('bot', html);
    }
    
    function addMessage(sender, content) {
        const messageId = 'msg-' + Date.now();
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
        
        // Add with animation
        messageDiv.style.opacity = '0';
        chatMessages.appendChild(messageDiv);
        
        // Trigger animation
        setTimeout(() => {
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 10);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageId;
    }
    
    function removeMessage(messageId) {
        const messageToRemove = document.getElementById(messageId);
        if (messageToRemove) {
            messageToRemove.remove();
        }
    }
    
    // Focus input field on load
    userInput.focus();
    
    // Add some animation on page load
    document.querySelectorAll('.message').forEach((msg, index) => {
        msg.style.animationDelay = `${index * 0.2}s`;
    });
});