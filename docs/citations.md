# EclimAi — Market Citations & Research Context

This document provides the sources and exact figures used to evaluate the market opportunity and justify the system architecture for EclimAi.

## Market Valuations

1. **Global Carbon Market (Compliance + Voluntary)**
   - **Valuation:** ~ $1 Trillion
   - **Context:** The vast majority of this value is derived from compliance markets (like the EU ETS), where heavily emitting industries are legally required to offset their emissions.

2. **Voluntary Carbon Market (VCM)**
   - **Valuation (Issued/Traded Value):** ~ $5.3 Billion
   - **Valuation (Spot Market Retirement):** ~ $535 Million
   - **Context:** The VCM is currently much smaller than the compliance market but is expected to grow significantly as corporations commit to Net Zero pledges. The $535M figure represents the value of credits strictly retired on spot markets in a recent year, whereas the broader multi-billion figure accounts for all primary issuance and secondary trading volume.

## Energy Efficiency Methodologies

EclimAi focuses specifically on generating carbon credits from commercial building energy efficiency. This is governed by specific frameworks:

1. **IPMVP Option C (Whole Facility)**
   - **Description:** The International Performance Measurement and Verification Protocol. Option C is used when assessing the energy performance of an entire facility. It requires comparing utility meter data from a baseline period (usually 12-36 months) to the reporting period, using regression models to normalize for independent variables like weather (Heating/Cooling Degree Days) and building occupancy.

2. **Verra VCS Methodologies**
   - **VM0014:** *Methodology for Demand-side Energy Efficiency Projects.* Used for projects replacing less efficient equipment or optimizing building systems, though it can be highly manual.
   - **AMS-II.C:** A UNFCCC Clean Development Mechanism (CDM) methodology for demand-side energy efficiency activities for specific technologies.

## Technology Ecosystem Context

To accelerate development and ensure interoperability with legacy systems, a production version of EclimAi could integrate with existing Web3 infrastructure:

1. **Hedera Guardian:** An open-source, decentralized MRV (dMRV) policy-as-code engine. It allows developers to digitize complex methodologies (like VM0014) into executable logic on the Hedera network.
2. **Thallo:** Web3 infrastructure focused on bridging legacy registries (like Verra and Gold Standard) onto public blockchains, ensuring that tokens represent legally valid and correctly retired carbon credits.

*EclimAi is a domain-specific vertical application that utilizes these types of protocols to offer a seamless, end-to-end product for building owners.*
