# 📋 PokéTower Defense — TO DO

> Las tareas marcadas con ✨ son sugerencias nuevas añadidas a la lista original.

---

## ⚔️ Pokémon y jugabilidad

- [ ] **Árbol de habilidades de los Pokémon**: mejoras por torre al subir de nivel o evolucionar (más alcance, más daño, efectos nuevos...).
- [ ] ✨ **Más Pokémon en la tienda**: ahora mismo hay 5 líneas (Charmander, Squirtle, Bulbasaur, Mankey y Growlithe). Faltan tipos como eléctrico, volador o psíquico.
- [ ] ✨ **Oleadas propias de cada mapa y dificultad**: ahora todos los mapas usan las mismas 10 oleadas.
- [ ] ✨ **Repaso del equilibrio**: probar partidas completas de la Ruta 2 y de la dificultad difícil, que aún no se han probado, y ajustar valores tras el cambio a casillas de 32 px.
- [ ] ✨ **Alcance en casillas**: guardar los valores como `range: 2.3` casillas en vez de en píxeles, y mostrarlo así en la barra lateral (ahora pone `ALC 73`, que no se entiende).

## 🏆 Progresión y cuenta

- [ ] **Sistema de puntos al pasarse mapas**: más puntos en difícil que en fácil.
- [ ] **Árbol de mejoras de la cuenta**: se compran con los puntos (dinero inicial, vidas extra, descuentos en la tienda...).
- [ ] ✨ **Desbloqueo de mapas**: por ejemplo, la Ruta 2 se abre al completar la Ruta 1.
- [ ] ✨ **Guardar la partida en curso** para poder seguir más tarde.

> 💡 Orden recomendado: **puntos → árbol de mejoras → base de datos**. El árbol necesita los puntos, y ambos necesitan un sitio donde guardarse.

## 🛒 Tiendas y equipo

> Estas tiendas son de la cuenta, fuera de las partidas, y se pagan con los puntos de la cuenta. La tienda de la barra lateral seguirá usando el dinero de la partida para colocar las torres.

- [ ] **Tienda de Pokémon**: los Pokémon se compran aquí. Solo puedes usar como torre los que ya tienes.
  - [ ] ✨ Pokémon iniciales gratis al crear la cuenta, para poder jugar desde el principio.
  - [ ] ✨ Precios según su rareza o su fuerza.
- [ ] **Menú de equipo**: antes de cada partida eliges tu equipo entre los Pokémon que tienes. Solo aparecen en la tienda de la partida los del equipo.
  - [ ] ✨ Decidir el tamaño máximo del equipo (por ejemplo, 5 o 6 Pokémon).
  - [ ] ✨ Recordar el último equipo usado.
- [ ] **Tienda de objetos**: objetos para comprar con los puntos de la cuenta.
  - [ ] ✨ Decidir qué objetos habrá. Ideas: objetos de un solo uso en la partida (Poción para recuperar vidas, Caramelo Raro para subir de nivel) o equipables por cada Pokémon.

> 💡 Dependen de los **puntos** (para pagar) y de la **base de datos** o del guardado local (para recordar qué Pokémon y objetos tienes).

## 🗺️ Mapas y gráficos

- [ ] **Tiles propios para crear el mapa** (césped, agua, montaña, camino...).
- [ ] ✨ **Autotiling**: piezas de borde y esquina para que las orillas y los caminos se vean naturales.
- [ ] ✨ **Hojas de andar del resto de enemigos** en `public/assets/running/`. Ahora solo tiene Rattata; los demás usan la animación frontal.
- [ ] ✨ **Más mapas**: basta con añadir una entrada a `MAPS` en `src/data/map.ts`.

## 🔊 Audio

- [ ] **Música nueva** para el juego.
- [x] **Menú de volumen** por separado para:
  - 🎵 Música
  - 💥 Efectos (ataques, enemigo derrotado, victoria, derrota...)

## ☁️ Base de datos y cuentas

- [ ] **Base de datos en Supabase** para guardar el estado de las cuentas.
  - [ ] ✨ Inicio de sesión de usuarios (Supabase Auth).
  - [ ] ✨ Reglas de seguridad (RLS) para que cada usuario solo lea y escriba sus datos.
  - [ ] ✨ Mantener el guardado local (`localStorage`) para jugar sin cuenta o sin conexión.

## 🛠️ Técnico

- [ ] ✨ **Tests de los mapas**: comprobar automáticamente que el camino va en tramos rectos y que ningún árbol, estanque o cartel cae encima.
- [ ] ✨ **Despliegue**: el `Dockerfile` actual solo sirve para desarrollo. Falta un build de producción para publicar el juego.
- [ ] ✨ **Controles táctiles** para jugar desde el móvil.

---

> ⚠️ **Música y tiles originales de Pokémon**: tienen copyright de Nintendo / Game Freak. Para uso personal no hay problema, pero si el juego se publica es más seguro usar recursos propios o con licencia libre.
