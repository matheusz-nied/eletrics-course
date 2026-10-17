# Ambientes HDRI

Mapas de ambiente usados pelo palco 3D (`src/three/core/Stage.tsx`). Todos são **CC0** (domínio público), do [Poly Haven](https://polyhaven.com/hdris), obtidos pela cópia do repositório [pmndrs/drei-assets](https://github.com/pmndrs/drei-assets/tree/master/hdri).

| Arquivo | Original | Uso |
|---------|----------|-----|
| `estudio-1k.hdr`, `estudio-512.hdr` | [Studio Small 03](https://polyhaven.com/a/studio_small_03), Sergej Majboroda | Peças e instrumentos (padrão) |
| `externo-1k.hdr`, `externo-512.hdr` | [Rooitou Park](https://polyhaven.com/a/rooitou_park), Greg Zaal | Cenas ao ar livre (portão, quintal) |
| `interno-1k.hdr`, `interno-512.hdr` | [Lebombo](https://polyhaven.com/a/lebombo), Greg Zaal | Cenas dentro de casa (quadro, tomadas) |

As versões `-1k` são as originais (1024 × 512). As versões `-512` (512 × 256) foram reduzidas com média em ponto flutuante, preservando a faixa dinâmica, e são usadas nos níveis de qualidade média e baixa.
