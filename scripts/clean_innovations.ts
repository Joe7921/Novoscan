import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

function loadEnv() {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            // remove quotes if any
            value = value.replace(/^['"]|['"]$/g, '');
            process.env[key] = value;
        }
    });
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanInnovations() {
    console.log('Fetching all innovation records to delete...');

    // We can't delete all rows without a condition using Supabase JS client unless we specify a filter.
    // Instead, we can delete rows where novelty_score is greater than or equal to 0, which covers all rows.
    const { data: fetchIds, error: fetchErr } = await supabase
        .from('innovations')
        .select('innovation_id');

    if (fetchErr) {
        console.error('Failed to fetch innovations:', fetchErr);
        return;
    }

    if (!fetchIds || fetchIds.length === 0) {
        console.log('No innovation records found to delete. The table is already clean.');
        return;
    }

    console.log(`Found ${fetchIds.length} records in innovations. Proceeding to delete relations first...`);

    const { error: relErr } = await supabase
        .from('innovation_relations')
        .delete()
        .gte('co_search_count', 0);

    if (relErr) {
        console.error('Failed to delete innovation_relations:', relErr);
        // Continue anyway, it might be empty
    } else {
        console.log('Successfully deleted all innovation relations.');
    }

    const { error: deleteErr } = await supabase
        .from('innovations')
        .delete()
        .gte('novelty_score', 0);

    if (deleteErr) {
        console.error('Failed to delete innovations:', deleteErr);
    } else {
        console.log('Successfully deleted all innovation records.');
    }
}

cleanInnovations();
