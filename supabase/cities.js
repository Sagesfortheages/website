// supabaseCities.js
import { supabaseClient } from './supabaseClient.js';

export async function loadAllCities() {

    try {
        // Fetch cities and their related akas from Supabase
        // Assuming you have a "cities" table and a related "city_akas" table
        const { data: cities, error } = await supabaseClient
            .from('city')
            .select(`
                city,
                country,
                latitude,
                longitude,
                city_aka(aka)
            `);

        if (error) throw error;

        // Map data into same shape as your Flask API
        const results = (cities || []).map(c => ({
            city: c.city,
            country: c.country,
            latitude: c.latitude,
            longitude: c.longitude,
            akas: c.city_akas?.map(a => a.aka) || []
        }));


        return {
            data: results,
            meta: {
                count: results.length
            }
        };
    } catch (error) {
        console.error('Error loading cities:', error);
        return { data: [], meta: { duration_seconds: 0, count: 0 } };
    }
}
