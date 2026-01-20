// Cloudflare Pages Function: POST /llm-search
// Endpoint: http(s)://<host>/llm-search
// Uses Claude to interpret natural language queries and return filter criteria

import { createClient } from "@supabase/supabase-js";

/**
 * Log LLM search query to Supabase for improvement tracking
 */
async function logSearchQuery(env, query, filters, resultCount, interpretation) {
  try {
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log("⚠️ Supabase not configured, skipping search log");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("llm_search_logs").insert({
      query: query,
      filters: filters,
      result_count: resultCount,
      interpretation: interpretation,
    });

    if (error) {
      console.error("⚠️ Failed to log search query:", error.message);
    } else {
      console.log("📝 Search query logged successfully");
    }
  } catch (err) {
    // Don't fail the request if logging fails
    console.error("⚠️ Search logging error:", err.message);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("🔍 Incoming LLM search request...");
  console.log(
    "🔐 Using Anthropic API Key:",
    env.ANTHROPIC_API_KEY ? "✅ Set" : "❌ Missing"
  );

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "LLM search service not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { query, assistanceTypes, zipCodes } = await request.json();

    if (!query || typeof query !== "string" || query.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Search query is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📦 Query:", query);

    // Build the system prompt with context about the data
    const systemPrompt = buildSystemPrompt(assistanceTypes, zipCodes);

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Claude API error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error?.message || "LLM search failed",
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse Claude's response
    const claudeResponse = data.content[0].text;
    console.log("🤖 Claude response:", claudeResponse);

    // Extract JSON from response
    const filters = parseClaudeResponse(claudeResponse);

    if (!filters) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Could not understand the search query. Please try rephrasing.",
          rawResponse: claudeResponse,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Parsed filters:", JSON.stringify(filters));

    // Log the search query (non-blocking, but kept alive via waitUntil)
    console.log("📝 Starting search log...");
    context.waitUntil(logSearchQuery(env, query, filters, null, filters.interpretation || null));

    return new Response(
      JSON.stringify({
        success: true,
        filters: filters,
        interpretation: filters.interpretation || null,
        geocode_address: filters.geocode_address || null,
        related_searches: filters.related_searches || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("🚨 Function error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Build the system prompt with context about available data
 */
function buildSystemPrompt(assistanceTypes, zipCodes) {
  // Format assistance types for the prompt
  const assistanceList = assistanceTypes
    ? assistanceTypes.map((a) => `- "${a.assistance}" (assist_id: "${a.assist_id}")`).join("\n")
    : `- Rent, Utilities, Food, Clothing
- Homeless - Shelters, Homeless - Day Centers, Homeless - Other, Housing
- Medical - Primary Care, Medical - Equipment, Medical - Mental Health, Medical - Addiction Recovery, Medical - Program Enrollment, Medical - Bill Payment
- Domestic Abuse - Shelters, Domestic Abuse - Other, Education - Children, Childcare
- Education - Adults, Jobs, Transportation, Legal, Immigration
- Seniors, Handyman, Animals, Christmas, Other`;

  // Format zip codes for the prompt (just mention they exist)
  const zipNote = zipCodes
    ? `Available Houston-area zip codes: ${zipCodes.slice(0, 10).map((z) => z.zip_code).join(", ")}... and more.`
    : "Houston-area zip codes like 77002, 77003, 77004, etc.";

  return `You are a search query interpreter for the Community Resources Guide Houston, a database of ~1000 community assistance resources.

Your job is to interpret natural language search queries and return structured filter criteria as JSON.

## AVAILABLE DATA FIELDS TO FILTER ON:

1. **Assistance Types** (filter by assist_id or assistance name):
${assistanceList}

2. **Zip Codes** - Filter by which zip codes an organization SERVES (client_zip_codes field):
${zipNote}

3. **Days of Week** - Filter by when open:
   Days use 2-letter codes: Mo, Tu, We, Th, Fr, Sa, Su

4. **Time of Day** - Filter by hours:
   - "morning" = before 12:00
   - "afternoon" = 12:00-17:00
   - "evening" = after 17:00
   - Specific times in 24-hour format: "09:00", "17:00"

5. **Status** - Filter by organization status:
   - status_id: 1 = Active, 2 = Limited, 3 = Inactive
   - Default to Active only unless user asks for all

6. **Distance** - If user mentions distance, include max_miles

7. **Keywords in Requirements/Hours Notes** - Search in requirements and hours_notes fields.
   Common hours_notes patterns include:
   - "By appointment only", "Call for hours", "Walk-ins only", "No appointment needed"
   - "2nd Week of Month Only", "Apply online", "Call for information"
   - Seasonal notes like "Jan 30th thru Apr 15th"

8. **Neighborhood** - Houston neighborhoods like: Meyerland, South Side, Downtown, Montrose,
   Heights, Galleria, Medical Center, Third Ward, Midtown, River Oaks, etc.

9. **Organization Name** - Search by organization name (e.g., "Catholic Charities", "Food Bank")

10. **County** - Filter by county where organization is LOCATED. Available counties include:
    Harris, Fort Bend, Montgomery, Brazoria, Galveston, Waller, Austin, Grimes, Walker, etc.
    Note: "Ft Bend" = "Fort Bend"

11. **City** - Filter by city where organization is LOCATED. Cities include:
    Houston, Katy, Sugar Land, Pearland, Pasadena, Baytown, Conroe, Galveston, etc.

## RESPONSE FORMAT:

Always respond with ONLY a JSON object (no markdown, no explanation outside the JSON):

{
  "assistance_types": ["Food", "Rent"],  // Array of assistance type names, or null if not specified
  "zip_codes": ["77002", "77003"],        // Array of zip codes to filter, or null if not specified
  "days": ["Mo", "Tu"],                   // Array of day codes, or null if not specified
  "time_filter": {                        // Time filter object, or null if not specified
    "type": "morning",                    // "morning", "afternoon", "evening", "before", "after", "between"
    "time": "12:00",                      // For "before"/"after" types
    "start": "09:00",                     // For "between" type
    "end": "17:00"                        // For "between" type
  },
  "status_ids": [1],                      // Array of status IDs (1=Active, 2=Limited, 3=Inactive), default [1]
  "max_miles": 5,                         // Maximum distance in miles, or null
  "requirements_keywords": ["walk-in"],   // Keywords to search in requirements AND hours_notes, or null
  "neighborhood": "Meyerland",            // Neighborhood name to search, or null
  "organization_name": "Catholic",        // Organization name to search, or null
  "county": "Fort Bend",                  // County where org is located, or null
  "city": "Katy",                         // City where org is located, or null
  "geocode_address": "1234 Main St, Houston, TX",  // Street address to geocode for distance calculation, or null
  "interpretation": "Food pantries open Monday mornings in zip code 77002",  // Human-readable interpretation
  "related_searches": ["groceries near me", "food bank open Saturday"]  // 2-3 related search suggestions
}

## EXAMPLES:

Query: "food pantry open Monday morning"
Response: {"assistance_types":["Food"],"zip_codes":null,"days":["Mo"],"time_filter":{"type":"morning"},"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Food assistance open Monday mornings","related_searches":["food bank open Saturday","groceries near me","meals for seniors"]}

Query: "rent help in 77027"
Response: {"assistance_types":["Rent"],"zip_codes":["77027"],"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Rent assistance serving zip code 77027","related_searches":["utilities help 77027","eviction prevention","housing assistance"]}

Query: "homeless shelter that accepts walk-ins"
Response: {"assistance_types":["Homeless - Shelters"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":["walk-in"],"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Homeless shelters that accept walk-ins","related_searches":["day center for homeless","meals for homeless","housing assistance"]}

Query: "medical help within 5 miles"
Response: {"assistance_types":["Medical - Primary Care","Medical - Equipment","Medical - Mental Health","Medical - Addiction Recovery","Medical - Program Enrollment","Medical - Bill Payment"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":5,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Medical assistance within 5 miles"}

Query: "anything open on Saturday"
Response: {"assistance_types":null,"zip_codes":null,"days":["Sa"],"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Any assistance open on Saturday"}

Query: "food in Meyerland"
Response: {"assistance_types":["Food"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":"Meyerland","organization_name":null,"county":null,"city":null,"interpretation":"Food assistance in Meyerland area"}

Query: "Catholic Charities"
Response: {"assistance_types":null,"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":"Catholic Charities","county":null,"city":null,"interpretation":"Services from Catholic Charities"}

Query: "by appointment only medical"
Response: {"assistance_types":["Medical - Primary Care","Medical - Equipment","Medical - Mental Health","Medical - Addiction Recovery","Medical - Program Enrollment","Medical - Bill Payment"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":["appointment"],"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Medical services requiring appointment"}

Query: "help for veterans"
Response: {"assistance_types":null,"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":["veteran"],"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Assistance for veterans"}

Query: "senior services"
Response: {"assistance_types":["Seniors"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"interpretation":"Services for seniors"}

Query: "childcare in Fort Bend county"
Response: {"assistance_types":["Childcare"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":"Fort Bend","city":null,"interpretation":"Childcare services in Fort Bend County"}

Query: "childcare in Ft Bend"
Response: {"assistance_types":["Childcare"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":"Fort Bend","city":null,"interpretation":"Childcare services in Fort Bend County"}

Query: "food in Galveston"
Response: {"assistance_types":["Food"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":"Galveston","city":null,"interpretation":"Food assistance in Galveston County"}

Query: "resources in Katy"
Response: {"assistance_types":null,"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":"Katy","interpretation":"All resources located in Katy"}

Query: "rent help in Pasadena"
Response: {"assistance_types":["Rent"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":"Pasadena","interpretation":"Rent assistance in Pasadena"}

Query: "shelters in Fort Bend"
Response: {"assistance_types":["Homeless - Shelters","Domestic Abuse - Shelters"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":"Fort Bend","city":null,"interpretation":"All shelters (homeless and domestic abuse) in Fort Bend County"}

Query: "education resources"
Response: {"assistance_types":["Education - Children","Education - Adults"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"geocode_address":null,"interpretation":"Education resources for children and adults"}

Query: "food near 1234 Main St Houston"
Response: {"assistance_types":["Food"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"geocode_address":"1234 Main St, Houston, TX","interpretation":"Food assistance near 1234 Main St, Houston"}

Query: "rent help within 3 miles of 5678 Westheimer Rd"
Response: {"assistance_types":["Rent"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":3,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"geocode_address":"5678 Westheimer Rd, Houston, TX","interpretation":"Rent assistance within 3 miles of 5678 Westheimer Rd"}

Query: "medical help close to 9900 Memorial Dr Houston TX 77024"
Response: {"assistance_types":["Medical - Primary Care","Medical - Equipment","Medical - Mental Health","Medical - Addiction Recovery","Medical - Program Enrollment","Medical - Bill Payment"],"zip_codes":null,"days":null,"time_filter":null,"status_ids":[1],"max_miles":null,"requirements_keywords":null,"neighborhood":null,"organization_name":null,"county":null,"city":null,"geocode_address":"9900 Memorial Dr, Houston, TX 77024","interpretation":"Medical assistance near 9900 Memorial Dr"}

IMPORTANT:
- Only return valid JSON, nothing else
- Use exact assistance type names from the list above
- SYNONYM EXPANSION (map common terms to assistance types):

  FOOD:
  - "groceries", "pantry", "food bank", "food pantry", "meals", "hungry", "eat" → Food

  UTILITIES:
  - "power bill", "electric bill", "electricity", "gas bill", "water bill", "light bill", "energy assistance", "LIHEAP" → Utilities

  RENT:
  - "rent help", "rent assistance", "eviction", "behind on rent", "can't pay rent", "rental assistance" → Rent

  CLOTHING:
  - "clothes", "clothing", "wardrobe", "dress", "shoes", "coat" → Clothing

  MEDICAL (expand to ALL medical types):
  - "medical", "health", "healthcare", "health care" → ALL medical types
  - "doctor", "clinic", "primary care", "checkup", "physical" → Medical - Primary Care
  - "wheelchair", "walker", "medical equipment", "DME", "crutches", "oxygen" → Medical - Equipment
  - "mental health", "counseling", "therapy", "therapist", "depression", "anxiety", "psychiatrist", "psychologist" → Medical - Mental Health
  - "rehab", "rehabilitation", "AA", "NA", "addiction", "substance abuse", "drug", "alcohol", "recovery", "detox", "sober" → Medical - Addiction Recovery
  - "medicaid", "medicare", "insurance enrollment", "ACA", "marketplace", "health insurance" → Medical - Program Enrollment
  - "medical bills", "hospital bill", "medical debt" → Medical - Bill Payment

  HOMELESS (expand to ALL homeless types):
  - "homeless", "unhoused", "street", "sleeping outside" → ALL homeless types
  - "homeless shelter", "emergency shelter", "place to sleep" → Homeless - Shelters
  - "day center", "warming center", "cooling center", "day shelter" → Homeless - Day Centers

  SHELTER (includes both homeless and domestic abuse):
  - "shelter", "shelters" → Homeless - Shelters, Domestic Abuse - Shelters

  DOMESTIC ABUSE:
  - "domestic abuse", "domestic violence", "DV", "abusive relationship", "battered", "abuse victim" → ALL domestic abuse types
  - "women's shelter", "safe house" → Domestic Abuse - Shelters

  HOUSING:
  - "housing", "apartment", "house", "place to live", "housing assistance", "section 8", "HUD" → Housing

  EDUCATION:
  - "education", "school", "learning" → ALL education types
  - "tutoring", "after school", "homework help", "kids education" → Education - Children
  - "GED", "ESL", "English class", "adult education", "literacy", "learn English", "high school equivalency" → Education - Adults

  CHILDCARE:
  - "childcare", "child care", "daycare", "day care", "preschool", "babysitter", "babysitting", "headstart", "head start" → Childcare

  JOBS:
  - "job", "jobs", "employment", "work", "job training", "career", "resume", "interview help", "workforce" → Jobs

  TRANSPORTATION:
  - "transportation", "bus pass", "metro", "ride", "bus", "transit", "gas money", "car repair" → Transportation

  LEGAL:
  - "legal", "lawyer", "attorney", "legal aid", "court", "legal help", "lawsuit" → Legal

  IMMIGRATION:
  - "immigration", "immigrant", "citizenship", "naturalization", "visa", "green card", "DACA", "asylum", "refugee" → Immigration

  SENIORS:
  - "senior", "seniors", "elderly", "older adult", "aging", "60+", "65+" → Seniors

  HANDYMAN:
  - "handyman", "home repair", "fix house", "repairs", "plumbing", "electrical work" → Handyman

  ANIMALS:
  - "pet", "pets", "animal", "dog", "cat", "pet food", "vet", "veterinary", "spay", "neuter" → Animals

  CHRISTMAS:
  - "christmas", "holiday", "toys", "holiday help", "gift", "angel tree" → Christmas

- Search requirements_keywords for eligibility criteria: "veteran", "senior", "disabled", "children", "no ID", "homeless", "low income", "SNAP", "food stamps"
- LOCATION DISAMBIGUATION:
  - "Galveston", "Fort Bend", "Montgomery", "Brazoria", "Harris" → use county filter (these are county names)
  - "Ft Bend", "Ft. Bend" → normalize to "Fort Bend" county
  - "Katy", "Pasadena", "Baytown", "Conroe", "Sugar Land" → use city filter (these are city names outside Houston)
  - "Meyerland", "Montrose", "Heights", "Galleria", "Third Ward" → use neighborhood filter (these are Houston neighborhoods)
  - When unsure if a place is a city vs county, prefer county for larger areas
- ADDRESS DETECTION for geocode_address field:
  - Extract street addresses from queries like "near 1234 Main St" or "close to 5678 Westheimer"
  - Add city/state if not specified (default to "Houston, TX" for Houston area)
  - Common patterns: "near [address]", "close to [address]", "within X miles of [address]"
  - If address is detected AND max_miles is mentioned, set both geocode_address and max_miles
  - If only address is detected (no distance), set geocode_address and leave max_miles null
- RELATED SEARCHES: Always include 2-3 related search suggestions that might help the user:
  - Suggest related assistance types (e.g., if searching "rent", suggest "utilities", "housing")
  - Suggest variations (e.g., different days, times, or locations)
  - Suggest broader or narrower searches
  - Keep suggestions short and natural (3-6 words each)
- If the query is unclear or doesn't relate to finding resources, return: {"error":"Could not interpret query","interpretation":"Please describe what type of assistance you're looking for"}`;
}

/**
 * Parse Claude's response to extract JSON filters
 */
function parseClaudeResponse(response) {
  try {
    // Try to parse the entire response as JSON
    const parsed = JSON.parse(response.trim());

    // Check if it's an error response
    if (parsed.error) {
      return null;
    }

    return parsed;
  } catch (e) {
    // Try to extract JSON from the response if it contains other text
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error) {
          return null;
        }
        return parsed;
      } catch (e2) {
        console.error("Failed to parse extracted JSON:", e2);
        return null;
      }
    }
    console.error("Failed to parse Claude response:", e);
    return null;
  }
}
