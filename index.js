const http = require('http');
const url = require('url');
const dotenv = require('dotenv');
dotenv.load({path: '.env'});
const googleMap = require("@google/maps");

// Address class
class Address {

    constructor(address, latitude, longitude) {
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    toStringGeo() {
        return `${this.address}, ${this.latitude}, ${this.longitude}`;
    }
}

// GeocodeBatch class
class GeocodeBatch {

    constructor(API_KEY, country) {
        this.country = country;
        this.googleClient = googleMap.createClient({
            key: API_KEY,
            timeout: 180000
        });
    }

    static coordinatesFromResponse(response) {
        return response.map(singleResponse => {
            return GeocodeBatch.coordinatesFromSingleResponse(singleResponse)
        });
    }

    static coordinatesFromSingleResponse(result) {
        let location = result.geometry.location;
        let latitude = location.lat.toFixed(6);
        let longitude = location.lng.toFixed(6);
        return new Address(result.formatted_address, latitude, longitude);
    }

    static async createPromise(googleClient, address, country) {
        let responseArray = [];
        try {
            let response = await GeocodeBatch.googleResponse(googleClient, address, country);
            let results = response.json.results;//response.json.results.length >1 ? [] :
            results.forEach(item => {
                item = new Array(item);
                let coordinates = GeocodeBatch.coordinatesFromResponse(item);
                responseArray.push(coordinates[0] || []);// || new Address(null, 0, 0)
            });
            return responseArray;
        } catch (e) {
            responseArray.push([]);
            return responseArray;
        }
    }

    static googleResponse(googleClient, address, country) {
        return new Promise((resolve, reject) => {
            googleClient.geocode({'address': address, 'components': {'country': country}}, function (err, response) {
                if (err) reject(err);
                resolve(response);
            });
        });
    }

//  address list result with promise
    async getGEOData(addresses) {
        const response = [];
        for (const address of addresses) {
            const result = await GeocodeBatch.createPromise(this.googleClient, address, this.country);
                response.push(result)
        }
        return response;
    }
}

http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    try {
        if (req.method === "POST") {
            const query = url.parse(req.url, true).query;
            const country = query.country || '';
            const API_KEY = process.env.API_KEY;
            let requestBody;
            let geobatch = new GeocodeBatch(API_KEY, country);

            req.on('data', (data) => {
                requestBody = data.toString('utf8');
                requestBody = requestBody.split('",').map(address => address.replace(/"/g, '').replace(/\[/g, '').replace(/\]/g, ''));
            });

            req.on('end', async () => {
                var response = await geobatch.getGEOData(requestBody);
                let responseData = {
                    result: [],
                    success: true,
                    error: []
                };

                responseData.result = response;

                res.write(JSON.stringify(responseData)); //end the response
                res.end();
            });
        } else {
            res.write('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
            res.end(); //end the response
        }
    } catch (error) {
        let responseData = {
            result: [],
            success: false,
            error: [],
        };
        responseData.error.push(error);
        res.write(JSON.stringify(responseData));
        res.end();
    }
}).listen(process.env.PORT); //the server object listens on port 8080

