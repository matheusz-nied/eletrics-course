---
termo: Decibel
resumo: 'Unidade logarítmica para comparar duas potências ou tensões. Em potência, 10·log₁₀ da relação: +3 dB é o dobro, +10 dB é dez vezes. Em tensão, 20·log₁₀: −3 dB é 70,7 %, −20 dB é um décimo. O dBm compara com 1 mW.'
sinonimos: [dB, dBm]
relacionados: [diagrama-de-bode, frequencia-de-corte, ganho, antena]
aula: m06-corrente-alternada/06-ressonancia-e-filtros
---
Para potências:

$$
G_\text{dB} = 10 \cdot \log_{10}\frac{P_2}{P_1}
$$

Para tensões e correntes, o fator é 20 em vez de 10, porque a potência cresce com o quadrado da tensão:

$$
G_\text{dB} = 20 \cdot \log_{10}\frac{V_\text{saída}}{V_\text{entrada}}
$$

Somar decibéis equivale a multiplicar as razões, o que facilita contas de rádio: potência do transmissor, ganho das antenas, perdas no caminho e sensibilidade do receptor se somam e se subtraem. Em dBm, a referência é 1 mW: 0 dBm = 1 mW, −10 dBm = 0,1 mW, −100 dBm = 0,1 picowatt (10⁻¹³ W). O decibel também mede o nível de som (dB SPL), comparando a pressão do som com um valor de referência.
