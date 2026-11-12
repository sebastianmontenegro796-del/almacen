/* Plano real del almacén, sacado del Modelador (https://claude.ai/artifact/6ogMqC3RPriQsHXtAi3myz),
   guardado el 2026-11-12. Medidas en metros. La vista 3D dibuja estos muebles; las ubicaciones
   (I, F, EST, D, S, P, E) tienen su posición en la base de datos, calculada a partir de aquí. */
window.ALMACEN_LAYOUT = {
  nave: {ancho: 9.89, fondo: 36.8},
  modulos: [
    {id: 'a', nombre: 'A · Hilera izquierda', tipo: 'metalica', x: 0.4, z: 11.45, rot: 90, huecos: 19, ancho: 1.2, fondo: 0.9, alto: 3, baldas: 3, doble: false, palesSuelo: 1, palesHueco: 1, carga: 'bebida', cargaAlto: 1.1, productos: true, arriba: true, cabeceros: 'no'},
    {id: 'b2', nombre: 'B · Rack del fondo', tipo: 'rack', x: 7.05, z: 0.6, rot: 0, huecos: 2, ancho: 2.8, fondo: 1.1, alto: 4, baldas: 4, doble: false, palesSuelo: 0, palesHueco: 3, carga: 'cajas', cargaAlto: 0.8, productos: true, arriba: true, cabeceros: 'no'},
    {id: 'c1', nombre: 'C · Hilera 1', tipo: 'gondola', x: 3.75, z: 12.65, rot: 90, huecos: 18, ancho: 1, fondo: 1.1, alto: 1.9, baldas: 5, doble: true, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'c2', nombre: 'C · Hilera 2', tipo: 'gondola', x: 5.65, z: 12.7, rot: 90, huecos: 18, ancho: 1, fondo: 1.1, alto: 1.9, baldas: 5, doble: true, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'c3', nombre: 'C · Hilera 3', tipo: 'metalica', x: 7.45, z: 14.85, rot: 90, huecos: 9, ancho: 2.1, fondo: 1.2, alto: 3, baldas: 5, doble: true, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: true, cabeceros: 'no'},
    {id: 'd', nombre: 'D · Pared derecha', tipo: 'metalica', x: 9.45, z: 16.75, rot: 270, huecos: 15, ancho: 1.55, fondo: 0.8, alto: 3, baldas: 4, doble: false, palesSuelo: 1, palesHueco: 1, carga: 'bebida', cargaAlto: 1, productos: true, arriba: true, cabeceros: 'no'},
    {id: 's', nombre: 'Palés suelo S', tipo: 'pale', x: 9.3, z: 3.65, rot: 90, huecos: 3, ancho: 1.1, fondo: 1, alto: 2, baldas: 4, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'bebida', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'ti', nombre: 'Entrada / tienda', tipo: 'zona', x: 3, z: 33.25, rot: 0, huecos: 1, ancho: 5.75, fondo: 6.9, alto: 2, baldas: 4, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'mmwbbiemf3m7', nombre: 'Palé P1', tipo: 'pale', x: 7.35, z: 4.7, rot: 180, huecos: 1, ancho: 1.1, fondo: 1, alto: 2, baldas: 4, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'bebida', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'mmwbbk5n43zh', nombre: 'Palés P2–P3', tipo: 'pale', x: 3, z: 0.6, rot: 180, huecos: 2, ancho: 1.1, fondo: 1, alto: 2, baldas: 4, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'bebida', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'mmwbcb4jd3qz', nombre: 'Zona nueva', tipo: 'zona', x: 8.25, z: 33.35, rot: 0, huecos: 1, ancho: 4.37, fondo: 6.9, alto: 2, baldas: 4, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'mmwbd1cw36jf', nombre: 'Nevera Coca-Cola', tipo: 'nevera', x: 0.55, z: 23.6, rot: 90, huecos: 2, ancho: 0.65, fondo: 0.75, alto: 2, baldas: 5, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'mmwbd2511631', nombre: 'Nevera Coca-Cola', tipo: 'nevera', x: 0.55, z: 24.9, rot: 90, huecos: 2, ancho: 0.65, fondo: 0.75, alto: 2, baldas: 5, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'},
    {id: 'mmwbdi9lz1yd', nombre: 'Estantería delante E', tipo: 'metalica', x: 6.45, z: 28, rot: 180, huecos: 2, ancho: 1.55, fondo: 0.8, alto: 3, baldas: 4, doble: false, palesSuelo: 1, palesHueco: 1, carga: 'bebida', cargaAlto: 1, productos: true, arriba: true, cabeceros: 'no'},
    {id: 'mmwclebc22lg', nombre: 'Nevera Coca-Cola', tipo: 'nevera', x: 4.4, z: 28, rot: 270, huecos: 2, ancho: 0.65, fondo: 0.75, alto: 2, baldas: 5, doble: false, palesSuelo: 0, palesHueco: 1, carga: 'cajas', cargaAlto: 1.2, productos: true, arriba: false, cabeceros: 'no'}
  ]
};
