import { Alert, Platform } from 'react-native';

/** Alert.alert no muestra nada en web; esto funciona en celular y en navegador */
export function avisar(titulo: string, mensaje = '') {
  if (Platform.OS === 'web') window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
  else Alert.alert(titulo, mensaje);
}
