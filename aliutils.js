require('dotenv').config();
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'api-cache.json');

/**
 * Load cache from file
 * @returns {Object} 
 */
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('Error loading cache:', error.message);
    }
    return {};
}

/**
 * Save cache to file
 * @param {Object} cache 
 */
function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving cache:', error.message);
    }
}

/**
 * make cache key based on search 
 * @param {Object} options 
 * @returns {string} 
 */
function getCacheKey(options) {
    const { q, page, sort } = options;
    return `${q}|${page}|${sort}`;
}

/**
 * hackclub ai sillyness
 * @param {string} query 
 * @returns {Promise<string>} 
 */
async function optimizeSearchQuery(query) {
    const hackclubApiKey = process.env.HACKCLUB_API_KEY;
    
    if (!hackclubApiKey) {
        console.warn('HACKCLUB_API_KEY not found in .env, using original query');
        return query;
    }

    try {
        console.log(`Optimizing search query: "${query}"`);
        
        const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hackclubApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen/qwen3-32b',
                messages: [{
                    role: 'user',
                    content: `You are a search query optimizer for AliExpress. Given a user's search query, generate a better, more concise search term that would yield better results on AliExpress. Make sure the search is short/general enough to actually yield responses. Return ONLY the optimized search query, nothing else. No explanations, no quotes, just the search term.

User's search query: ${query}`
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`HackClub AI request failed: ${response.status}`);
        }

        const data = await response.json();
        const optimizedQuery = data.choices?.[0]?.message?.content?.trim();
        
        if (optimizedQuery) {
            console.log(`Optimized query: "${optimizedQuery}"`);
            return optimizedQuery;
        }
        
        return query;
    } catch (error) {
        console.warn(`Error optimizing query: ${error.message}. Using original query.`);
        return query;
    }
}

/**
 * search aliexpress
 * @param {Object} options 
 * @param {string} options.q - Search query
 * @param {number} options.page - Page number (default: 1)
 * @param {string} options.sort - Sort method: 'default', 'orders', 'newest', 'price_low', 'price_high' (default: 'default')
 * @param {string|string[]} options.rapidApiKey - api keys
 * @returns {Promise<Object>} Search 
 */
async function searchAliExpress(options) {
    const {
        q,
        page = 1,
        sort = 'default',
        rapidApiKey = process.env.RAPIDAPI_KEY
    } = options;

    if (!q) {
        throw new Error('Search query (q) is required');
    }

    // Check cache with original query first
    const cacheKey = getCacheKey({ q, page, sort });
    const cache = loadCache();
    
    if (cache[cacheKey]) {
        console.log('Returning cached results for:', cacheKey);
        return cache[cacheKey];
    }

    // Optimize the search query using HackClub AI only if not cached
    const optimizedQuery = await optimizeSearchQuery(q);
    if (!rapidApiKey) {
        throw new Error('RapidAPI key is required. Set RAPIDAPI_KEY in .env file');
    }

    let apiKeys;
    if (Array.isArray(rapidApiKey)) {
        apiKeys = rapidApiKey;
    } else if (typeof rapidApiKey === 'string') {
        apiKeys = rapidApiKey.split(',').map(key => key.trim());
    } else {
        apiKeys = [rapidApiKey];
    }
    
    const url = new URL('https://aliexpress-datahub.p.rapidapi.com/item_search_2');
    url.searchParams.append('q', optimizedQuery);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('sort', sort);

    let lastError = null;

    for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        console.log(`Trying API key ${i + 1} of ${apiKeys.length}`);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'x-rapidapi-host': 'aliexpress-datahub.p.rapidapi.com',
                    'x-rapidapi-key': currentKey
                }
            });

            if (response.status === 403) {
                console.warn(`API key ${i + 1} returned 403, trying next key...`);
                lastError = new Error(`API key ${i + 1} returned 403 Forbidden`);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response status:', response.status);
                console.error('Response headers:', Object.fromEntries(response.headers.entries()));
                console.error('Response body:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`API Error: ${data.error}`);
            }

            const results = data.result?.resultList?.slice(0, 3).map(item => ({
                title: item.item?.title,
                price: item.item?.sku?.def?.promotionPrice,
                image: item.item?.image ? `https:${item.item.image}` : item.item?.image,
                url: item.item?.itemUrl ? `https:${item.item.itemUrl}` : item.item?.itemUrl
            })) || [];

            console.log(`Successfully retrieved results using API key ${i + 1}`);
            
            // Save to cache
            cache[cacheKey] = results;
            saveCache(cache);
            
            return results;
        } catch (error) {
            lastError = error;
            if (i < apiKeys.length - 1) {
                console.warn(`Error with API key ${i + 1}: ${error.message}. Trying next key...`);
                continue;
            }
        }
    }

    throw new Error(`Failed to search AliExpress with all ${apiKeys.length} API key(s). Last error: ${lastError.message}`);
}

module.exports = {
    searchAliExpress
};
