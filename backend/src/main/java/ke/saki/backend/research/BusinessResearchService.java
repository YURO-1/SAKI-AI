package ke.saki.backend.research;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import ke.saki.backend.idea.BusinessIdea;
import ke.saki.backend.idea.BusinessIdeaService;
import ke.saki.backend.research.BusinessResearchResponse.ResearchResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@Service
public class BusinessResearchService {
    private static final String GEOGRAPHY = "Kenya";
    private final BusinessIdeaService ideas;
    private final RestClient searchClient;
    private final String apiKey;

    public BusinessResearchService(
            BusinessIdeaService ideas,
            RestClient.Builder restClientBuilder,
            @Value("${saki.research.tavily.api-key:}") String apiKey) {
        this.ideas = ideas;
        this.apiKey = apiKey;
        this.searchClient = restClientBuilder
                .baseUrl("https://api.tavily.com")
                .build();
    }

    public BusinessResearchResponse research(String email, UUID ideaId) {
        BusinessIdea idea = ideas.findIdea(email, ideaId);
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Online search is not configured. Set TAVILY_API_KEY on the backend.");
        }

        String sector = idea.getSectorGroup();
        SearchProfile profile = searchProfile(idea.getName(), sector);
        String businessName = searchName(idea.getName(), sector);
        String issueTerms = "tax rates KRA criminal activity crime theft corruption bribery market competition";
        String query = "\"problems facing\" \"" + businessName + "\" in Kenya "
                + profile.businessType() + " " + issueTerms + " " + profile.queryTerms();
        String redditQuery = "\"" + businessName + "\" " + profile.businessType()
                + " Kenya problems challenges " + issueTerms + " " + profile.queryTerms();
        JsonNode webResults = search(query, List.of());
        JsonNode redditResults = search(redditQuery, List.of("reddit.com"));

        return toResponse(
                List.of(webResults, redditResults),
                sector,
                profile,
                businessName,
                "Web: " + query + " | Reddit: " + redditQuery);
    }

    private JsonNode search(String query, List<String> includeDomains) {
        Map<String, Object> request = new HashMap<>();
        request.put("api_key", apiKey);
        request.put("query", query);
        request.put("search_depth", "basic");
        request.put("topic", "general");
        request.put("country", "kenya");
        request.put("time_range", "year");
        request.put("include_published_date", true);
        request.put("max_results", includeDomains.isEmpty() ? 6 : 4);
        request.put("include_answer", false);
        request.put("include_raw_content", false);
        if (!includeDomains.isEmpty()) request.put("include_domains", includeDomains);

        try {
            JsonNode response = searchClient.post()
                    .uri("/search")
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Tavily returned an empty search response.");
            }
            return response;
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    providerFailureMessage(exception.getStatusCode().value()),
                    exception);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Could not connect to Tavily. Check the backend's internet access and try again.",
                    exception);
        }
    }

    private String providerFailureMessage(int status) {
        if (status == 401 || status == 403) {
            return "Tavily denied the request. Check that TAVILY_API_KEY is valid.";
        }
        if (status == 429) {
            return "Tavily's free monthly credits or rate limit may have been reached. Check your Tavily dashboard.";
        }
        if (status == 400) {
            return "Tavily rejected the search request. Check the API key and try again.";
        }
        return "Tavily returned HTTP " + status + ". Check the API key and try again.";
    }

    private BusinessResearchResponse toResponse(
            List<JsonNode> responses,
            String sector,
            SearchProfile profile,
            String businessName,
            String query) {
        List<ResearchResult> results = new ArrayList<>();
        LinkedHashSet<String> keySignals = new LinkedHashSet<>();
        Set<String> seenUrls = new LinkedHashSet<>();

        for (JsonNode response : responses) {
            JsonNode items = response == null ? null : response.path("results");
            if (items == null || !items.isArray()) continue;

            for (JsonNode item : items) {
                String url = item.path("url").asString("");
                String title = item.path("title").asString("");
                String snippet = item.path("content").asString("");
                if (!isHttpsUrl(url) || title.isBlank() || snippet.isBlank() || seenUrls.contains(url)) continue;
                String evidence = title + " " + snippet;
                if (!mentionsBusiness(evidence, businessName, profile)) continue;
                List<String> matchedTopics = profile.signalRules().stream()
                        .filter(rule -> rule.pattern().matcher(evidence).find())
                        .map(SignalRule::label)
                        .toList();
                if (matchedTopics.isEmpty()) continue;
                seenUrls.add(url);

                JsonNode publishedDate = item.path("published_date");
                keySignals.addAll(matchedTopics);
                results.add(new ResearchResult(
                        title,
                        url,
                        snippet,
                        publishedDate.isString() ? publishedDate.asString() : null,
                        matchedTopics));
            }
        }

        return new BusinessResearchResponse(
                Instant.now(),
                sector,
                GEOGRAPHY,
                profile.businessType(),
                query,
                List.copyOf(keySignals),
                results);
    }

    private SearchProfile searchProfile(String ideaName, String sector) {
        String name = ideaName.toLowerCase(Locale.ROOT);
        if (containsAny(name, "butcher", "butchery", "meat shop")) {
            return profile(
                    "butchery",
                    "butcher shop meat quality food safety spoilage refrigeration cold chain meat supply prices hygiene inspection challenges forum",
                    signal("Meat quality and food safety", "meat|beef|carcass|spoil\\w*|contaminat\\w*|hygiene|inspection|slaughter\\w*"),
                    signal("Cold storage and power", "refrigerat\\w*|cold chain|freezer|chiller|power outage|electricity"),
                    signal("Meat supply and prices", "supplier|supply|livestock|wholesale|price\\w*|cost\\w*|margin\\w*"));
        }
        if (containsAny(name, "industrial hub", "industrial park", "industrial estate",
                "special economic zone", "export processing zone", "logistics hub")) {
            return profile(
                    "industrial hub",
                    "industrial hub park estate Kenya problems infrastructure utilities electricity water roads port land acquisition leases permits taxes security corruption tenants competition",
                    signal("Infrastructure and utility access", "power|electricity|outage|water|road\\w*|port|infrastructure|connectivity"),
                    signal("Land, leases and permits", "land|lease\\w*|rent|permit\\w*|licen[cs]\\w*|county|tax\\w*|fee\\w*"),
                    signal("Tenants and investment", "tenant\\w*|occup\\w*|invest\\w*|compet\\w*|demand|vacanc\\w*"));
        }
        if (containsAny(name, "bakery", "baker")) {
            return profile(
                    "bakery",
                    "bakery Kenya flour wheat sugar yeast ingredient prices food safety spoilage oven electricity power small business challenges forum",
                    signal("Ingredient costs and supply", "flour|wheat|sugar|yeast|ingredient|supplier|supply|price\\w*|cost\\w*"),
                    signal("Food safety and spoilage", "food safety|hygiene|expiry|spoil\\w*|contaminat\\w*"),
                    signal("Energy and baking equipment", "electricity|power outage|fuel|oven|equipment|maintenance"));
        }
        if (containsAny(name, "restaurant", "cafe", "café", "eatery")) {
            return profile(
                    "restaurant or cafe",
                    "restaurant cafe Kenya food prices food safety spoilage supplier refrigeration electricity business challenges forum",
                    signal("Food costs and supply", "food prices|ingredient|supplier|supply|wholesale|cost\\w*"),
                    signal("Food safety and spoilage", "food safety|hygiene|expiry|spoil\\w*|contaminat\\w*"),
                    signal("Power and refrigeration", "electricity|power outage|refrigerat\\w*|cold storage"));
        }
        if (containsAny(name, "salon", "barber", "barbershop")) {
            return profile(
                    "salon or barbershop",
                    "salon barbershop Kenya beauty services product supply electricity rent licensing small business challenges forum",
                    signal("Product supply and prices", "product|supplier|supply|price\\w*|cost\\w*"),
                    signal("Power and operating costs", "electricity|power outage|rent|lease|operating cost"),
                    signal("Licensing and hygiene", "licen[cs]\\w*|permit|hygiene|inspection|county"));
        }
        if (containsAny(name, "grocery", "greengrocer", "mini market", "minimart", "supermarket")) {
            return profile(
                    "grocery or mini-market",
                    "grocery mini market Kenya food prices stock supply spoilage refrigeration retail shop business challenges forum",
                    signal("Stock supply and prices", "stock|supplier|supply|wholesale|price\\w*|cost\\w*"),
                    signal("Food spoilage and storage", "food|expiry|spoil\\w*|refrigerat\\w*|cold storage"),
                    signal("Power and operating costs", "electricity|power outage|rent|lease|operating cost"));
        }

        return profile(
                sector,
                "\"" + sector + "\" Kenya small business costs prices supply licensing operating challenges forum discussions",
                false,
                signal("Costs and prices", "price\\w*|cost\\w*|inflation|margin\\w*"),
                signal("Supply and stock", "supplier|supply|stock|shortage|availability"),
                signal("Operating requirements", "licen[cs]\\w*|permit|inspection|electricity|power outage|rent|transport"));
    }

    private String searchName(String ideaName, String sector) {
        String safeName = ideaName
                .replaceAll("[^\\p{L}\\p{N}\\s&'-]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return safeName.isBlank() ? sector : safeName;
    }

    private SearchProfile profile(String businessType, String queryTerms, SignalRule... signalRules) {
        return profile(businessType, queryTerms, true, signalRules);
    }

    private SearchProfile profile(
            String businessType,
            String queryTerms,
            boolean specificBusinessType,
            SignalRule... signalRules) {
        List<SignalRule> allRules = new ArrayList<>(List.of(
                signal("Taxes and fees", "tax\\w*|kra|vat|levy|levies|county fee\\w*|license\\w*|licence\\w*|permit\\w*"),
                signal("Crime and security", "crime|criminal|theft|steal\\w*|robber\\w*|burglary|extortion|fraud|security|shoplift\\w*"),
                signal("Corruption and bribery", "corrupt\\w*|brib\\w*|kickback\\w*"),
                signal("Competition", "compet\\w*|market saturation|price war\\w*|competitor\\w*|undercut\\w*")));
        allRules.addAll(List.of(signalRules));
        return new SearchProfile(
                businessType,
                queryTerms,
                List.copyOf(allRules),
                businessPattern(businessType),
                specificBusinessType);
    }

    private boolean mentionsBusiness(String evidence, String businessName, SearchProfile profile) {
        String normalizedEvidence = evidence.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
        String normalizedName = businessName.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
        return normalizedEvidence.contains(normalizedName)
                || (profile.specificBusinessType() && profile.businessPattern().matcher(evidence).find());
    }

    private Pattern businessPattern(String businessType) {
        String terms = switch (businessType) {
            case "butchery" -> "butcher\\w*|butchery|meat shop|meat trade";
            case "bakery" -> "bakery|baker\\w*|bread maker|baked goods";
            case "restaurant or cafe" -> "restaurant\\w*|cafe\\w*|café\\w*|eatery|food service";
            case "salon or barbershop" -> "salon\\w*|barber\\w*|hairdresser\\w*|beauty service";
            case "grocery or mini-market" -> "grocery|groceries|mini[ -]?market|supermarket|greengrocer";
            case "industrial hub" -> "industrial hub\\w*|industrial park\\w*|industrial estate\\w*|special economic zone\\w*|export processing zone\\w*|industrial zone\\w*";
            default -> Pattern.quote(businessType);
        };
        return Pattern.compile("\\b(?:" + terms + ")\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    }

    private SignalRule signal(String label, String keywords) {
        return new SignalRule(
                label,
                Pattern.compile("\\b(?:" + keywords + ")\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE));
    }

    private boolean containsAny(String value, String... terms) {
        for (String term : terms) {
            if (value.contains(term)) return true;
        }
        return false;
    }

    private boolean isHttpsUrl(String value) {
        return value.startsWith("https://");
    }

    private record SearchProfile(
            String businessType,
            String queryTerms,
            List<SignalRule> signalRules,
            Pattern businessPattern,
            boolean specificBusinessType) {
    }

    private record SignalRule(String label, Pattern pattern) {
    }
}
