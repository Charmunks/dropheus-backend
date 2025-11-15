# Dropheus Backend

This is the backend for Dropheus, which is a chrome extension that allows you to select an etsy item and check if their are matching items on AliExpress, to detect dropshipping. 

The backend takes in requests at /search?q=searchTerm and will return the first 3 results from aliexpress, with their urls, prices, and images. This is used by the Dropheus chrome extension to check if there are matching items on AliExpress for an Etsy item.
