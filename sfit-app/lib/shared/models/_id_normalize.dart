/// Normaliza el JSON crudo de Mongo (que devuelve `_id`) al formato esperado
/// por los DTOs freezed que usan campo `id`. Llama esto en el servicio
/// antes de hacer `XModel.fromJson(...)`.
///
/// Nota: el backend a veces devuelve `id`, otras `_id` (depende de si pasó
/// por un serializador o no). Este helper cubre ambos casos sin perder data.
Map<String, dynamic> normalizeBackendJson(Map<String, dynamic> json) {
  if (json['_id'] != null && json['id'] == null) {
    return {...json, 'id': json['_id']};
  }
  return json;
}
