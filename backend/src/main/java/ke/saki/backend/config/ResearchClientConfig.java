package ke.saki.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class ResearchClientConfig {
    @Bean
    RestClient.Builder researchRestClientBuilder() {
        return RestClient.builder();
    }
}
