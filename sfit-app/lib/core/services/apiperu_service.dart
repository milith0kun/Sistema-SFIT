import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../network/dio_client.dart';

part 'apiperu_service.g.dart';

@riverpod
ApiPeruService apiPeruService(Ref ref) =>
    ApiPeruService(ref.watch(dioClientProvider).dio);

class DniResult {
  final String nombres;
  final String apellidoPaterno;
  final String apellidoMaterno;
  final String nombreCompleto;

  const DniResult({
    required this.nombres,
    required this.apellidoPaterno,
    required this.apellidoMaterno,
    required this.nombreCompleto,
  });

  factory DniResult.fromJson(Map<String, dynamic> j) => DniResult(
        nombres: j['nombres'] as String? ?? '',
        apellidoPaterno: j['apellido_paterno'] as String? ?? '',
        apellidoMaterno: j['apellido_materno'] as String? ?? '',
        nombreCompleto: j['nombre_completo'] as String? ??
            '${j['nombres'] ?? ''} ${j['apellido_paterno'] ?? ''} ${j['apellido_materno'] ?? ''}'
                .trim(),
      );
}

class RucResult {
  final String ruc;
  final String razonSocial;
  final String? nombreComercial;
  final String estado;
  final String condicion;
  final String? domicilio;
  final String? departamento;
  final String? provincia;
  final String? distrito;

  const RucResult({
    required this.ruc,
    required this.razonSocial,
    required this.estado,
    required this.condicion,
    this.nombreComercial,
    this.domicilio,
    this.departamento,
    this.provincia,
    this.distrito,
  });

  factory RucResult.fromJson(Map<String, dynamic> j) => RucResult(
        ruc: j['ruc'] as String? ?? '',
        razonSocial: j['razon_social'] as String? ?? '',
        nombreComercial: j['nombre_comercial'] as String?,
        estado: j['estado'] as String? ?? '',
        condicion: j['condicion'] as String? ?? '',
        domicilio: j['domicilio'] as String?,
        departamento: j['departamento'] as String?,
        provincia: j['provincia'] as String?,
        distrito: j['distrito'] as String?,
      );

  bool get esActivo =>
      estado.toUpperCase().contains('ACTIVO') &&
      condicion.toUpperCase().contains('HABIDO');
}

class ApiPeruService {
  final Dio _dio;
  ApiPeruService(this._dio);

  /// Consulta DNI (requiere token JWT — para formularios autenticados).
  Future<DniResult> consultarDni(String dni) async {
    final resp = await _dio.post('/validar/dni', data: {'dni': dni});
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return DniResult.fromJson(data);
  }

  /// Consulta DNI sin autenticación (para página de registro).
  Future<DniResult> consultarDniPublico(String dni) async {
    final resp = await _dio.post('/public/validar-dni', data: {'dni': dni});
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return DniResult.fromJson(data);
  }

  /// Consulta RUC (requiere token JWT).
  Future<RucResult> consultarRuc(String ruc) async {
    final resp = await _dio.post('/validar/ruc', data: {'ruc': ruc});
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return RucResult.fromJson(data);
  }
}
