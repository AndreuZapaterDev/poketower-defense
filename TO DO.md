# 📋 PokéTower Defense — TO DO

> Las tareas marcadas con ✨ son sugerencias nuevas añadidas a la lista original.

---

## ⚔️ Pokémon y jugabilidad

- [x] **Árbol de habilidades de los Pokémon**: cada Pokémon colocado gana puntos al evolucionar (2) y cada 3 niveles de experiencia (1), y los gasta en su árbol (botón HABILIDADES o tecla H): FUERZA (daño y una habilidad especial según su ataque), ALCANCE (alcance y críticos) y RAPIDEZ (velocidad y más dinero por KO). Ver `src/data/skills.ts`.
- [ ] ✨ **Más Pokémon en la tienda**: ahora mismo hay 5 líneas (Charmander, Squirtle, Bulbasaur, Mankey y Growlithe). Faltan tipos como eléctrico, volador o psíquico.
- [x] ✨ **Oleadas propias de cada mapa y dificultad**: cada mapa tiene las suyas en `src/data/waves.ts` (la Ruta 1, de bosque; el gimnasio, de tipo roca). En difícil, cada grupo trae un 25 % más de Pokémon, salen más seguidos y hay 2 oleadas más al final.
- [ ] ✨ **Repaso del equilibrio**: probar partidas completas de la Ruta 2 y de la dificultad difícil, que aún no se han probado, y ajustar valores tras el cambio a casillas de 32 px.
- [x] ✨ **Alcance en casillas**: guardar los valores como `range: 2.3` casillas en vez de en píxeles, y mostrarlo así en la barra lateral (ahora pone `ALC 73`, que no se entiende).

## 🏆 Progresión y cuenta

- [x] **Sistema de puntos al pasarse mapas**: al acabar cada partida se ganan puntos por oleada superada, por ganar y por completar un mapa la primera vez; en difícil, el doble (`src/data/points.ts`). Se ven en la pantalla final, el menú principal y la selección de mapa.
- [x] **Árbol de mejoras de la cuenta**: pantalla MEJORAS en el menú principal, con dos ramas (ECONOMÍA: ahorros, premio por oleada, rebajas; ENTRENAMIENTO: aguante, experiencia, puntería) de 5 niveles cada mejora. Se pueden devolver los puntos (`src/data/upgrades.ts`).
- [x] ✨ **Desbloqueo de mapas**: el Gimnasio Plateada se abre al completar la Ruta 1 (en cualquier dificultad). Cada mapa indica cuál lo abre con `unlockedBy`.
- [x] ✨ **Guardar la partida en curso**: se guarda sola entre oleadas (`src/savedGame.ts`); en la selección de mapa la opción guardada pregunta si continuar o empezar de nuevo. Si se sale a mitad de una oleada, esa oleada se repite.

> 💡 Orden recomendado: **puntos → árbol de mejoras → base de datos**. El árbol necesita los puntos, y ambos necesitan un sitio donde guardarse.

## 🛒 Tiendas y equipo

> Estas tiendas son de la cuenta, fuera de las partidas, y se pagan con los puntos de la cuenta. La tienda de la barra lateral seguirá usando el dinero de la partida para colocar las torres.

- [x] **Tienda de Pokémon**: TIENDA DE POKéMON en el menú principal (`src/data/pokemonShop.ts`). En la partida, los que no tienes salen bloqueados con un candado.
  - [x] ✨ Pokémon iniciales gratis al crear la cuenta: Charmander, Squirtle y Bulbasaur.
  - [x] ✨ Precios según su fuerza: Mankey 150 puntos y Growlithe 200.
- [x] **Menú de equipo**: pantalla EQUIPO al estilo del PC de los juegos (equipo a la izquierda, CAJA 1 a la derecha). Solo aparecen en la tienda de la partida los del equipo.
  - [x] ✨ Tamaño del equipo: se empieza con 4 huecos y la mejora AMISTAD de la cuenta (rama EQUIPO) abre el 5.º y el 6.º, como el equipo de los juegos (`BASE_TEAM_SIZE` y `MAX_TEAM_SIZE` en `src/data/team.ts`).
  - [x] ✨ Recordar el último equipo usado. Al comprar un Pokémon se une al equipo si hay hueco.
- [x] **Tienda de objetos**: TIENDA DE OBJETOS en el menú principal, al estilo de la Tienda Pokémon. Vende las Tablas de `public/assets/items` con los puntos de la cuenta (`src/data/items.ts`).
  - [x] ✨ Decidir qué objetos habrá: por ahora las Tablas, que se compran una vez y hacen que los Pokémon de su tipo peguen un 20 % más en todas las partidas. Las de tipos sin Pokémon en la tienda salen como PRONTO.
  - [ ] ✨ Más objetos: de un solo uso en la partida (Poción para recuperar vidas, Caramelo Raro para subir de nivel)...

> 💡 Dependen de los **puntos** (para pagar) y de la **base de datos** o del guardado local (para recordar qué Pokémon y objetos tienes).

## 🗺️ Mapas y gráficos

- [x] ✨ **Autotiling**: los suelos con autotile de RPG Maker XP (`public/assets/tiles`: hierba clara, arena, grava, tierra, ladrillo, camino blanco) eligen sus bordes y esquinas solos (`ground` en los mapas). Los estanques sobre arena o tierra usan su orilla.

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

- [x] ✨ **Tests de los mapas**: `npm test` (Vitest, en `tests/maps.test.ts`) comprueba que el camino va en tramos rectos, que nada pisa el camino, la meta ni otra cosa, que la hierba alta no toca el camino, que hay sitio para construir y que los desbloqueos son correctos.
- [x] ✨ **Despliegue**: `Dockerfile.prod` compila el juego (pasando los tests) y lo sirve con nginx (`nginx.conf`: gzip y caché). Se arranca con `docker compose -f docker-compose.prod.yml up --build -d` y queda en http://localhost:8080.
- [x] ✨ **Controles táctiles**: en el móvil, el primer toque en una casilla enseña la vista previa y el segundo coloca el Pokémon; tocar otra vez la tarjeta de la tienda cancela. Sin zoom ni desplazamiento de la página, pantalla completa al empezar y aviso para girar el móvil en vertical.

---

> ⚠️ **Música y tiles originales de Pokémon**: tienen copyright de Nintendo / Game Freak. Para uso personal no hay problema, pero si el juego se publica es más seguro usar recursos propios o con licencia libre.
