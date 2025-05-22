import axios from 'axios';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv'
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });


export async function loginAndGetTokens() {
    const url = `${process.env.BASE_URL}/oauth/login`;
    const requestData = {
        API_Key: process.env.API_KEY,
        API_Value: process.env.API_VALUE
    };

    const config = {
        headers: {
            
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await axios.post(url, requestData, config);
        const accessToken = response.data.Access_Token.token;
        const refreshToken = response.data.Refresh_Token.token;
        await refreshAuthToken(refreshToken);
        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Failed to log in and get tokens:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);

        return { accessToken: null, refreshToken: null };
    }
}


export async function refreshAuthToken(refreshToken) {
    const url = `${process.env.BASE_URL}/oauth/refresh`;
    const headers = {
        'Authorization': `VRS ${refreshToken}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.get(url, { headers });
        if (response.data && response.data.Access_Token) {
            const newAccessToken = response.data.Access_Token.token;
            return newAccessToken;
        } else {
            console.error('Refresh token response missing expected data:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return null;
    }
}
