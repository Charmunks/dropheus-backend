require('dotenv').config();

/**
 * Search AliExpress products by keyword using RapidAPI
 * @param {Object} options - Search options
 * @param {string} options.q - Search query/keyword (required)
 * @param {number} options.page - Page number (default: 1)
 * @param {string} options.sort - Sort method: 'default', 'orders', 'newest', 'price_low', 'price_high' (default: 'default')
 * @param {string} options.rapidApiKey - RapidAPI key (defaults to RAPIDAPI_KEY from .env)
 * @returns {Promise<Object>} Search results
 */
async function searchAliExpress(options) {
    const {
        q,
        page = 1,
        sort = 'default',
        rapidApiKey = process.env.RAPIDAPI_KEY
    } = options;
    console.log(rapidApiKey)
    // Validate required parameters
    if (!q) {
        throw new Error('Search query (q) is required');
    }
    if (!rapidApiKey) {
        throw new Error('RapidAPI key is required. Set RAPIDAPI_KEY in .env file');
    }

    // Build request URL
    const url = new URL('https://aliexpress-datahub.p.rapidapi.com/item_search_2');
    url.searchParams.append('q', q);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('sort', sort);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'aliexpress-datahub.p.rapidapi.com',
                'x-rapidapi-key': rapidApiKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response status:', response.status);
            console.error('Response headers:', Object.fromEntries(response.headers.entries()));
            console.error('Response body:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        
        // Check for API errors
        if (data.error) {
            throw new Error(`API Error: ${data.error}`);
        }

        // Extract only the first 3 results with specific fields
        const results = data.result?.resultList?.slice(0, 3).map(item => ({
            title: item.item?.title,
            price: item.item?.sku?.def?.promotionPrice,
            image: item.item?.image,
            url: item.item?.itemUrl
        })) || [];

        return results;
    } catch (error) {
        throw new Error(`Failed to search AliExpress: ${error.message}`);
    }
}

module.exports = {
    searchAliExpress
};
