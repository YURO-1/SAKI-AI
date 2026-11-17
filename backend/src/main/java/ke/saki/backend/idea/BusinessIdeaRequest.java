package ke.saki.backend.idea;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record BusinessIdeaRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Pattern(regexp = "Retail trade|Wholesale & motor trade|Food & accommodation|Personal services|Education & health|Manufacturing|Transport & storage|Business & financial services|Construction|Other") String sectorGroup,
        @NotBlank @Size(max = 120) String location,
        @NotBlank @Pattern(regexp = "Commercial premises|Residential|Market stall / kiosk|Industrial / jua kali|Open-air / mobile / other") String premisesGroup,
        @Positive double initialCapitalKsh,
        boolean registered,
        @NotNull @Min(0) Integer mainBuyerCode,
        @NotNull @Min(0) Integer capitalSourceCode,
        @Min(0) int foundingEmployees) {
}
