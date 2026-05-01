class FeedVehicle {
  final String? plate;
  final String? brand;
  final String? model;

  const FeedVehicle({this.plate, this.brand, this.model});

  factory FeedVehicle.fromJson(Map<String, dynamic> j) => FeedVehicle(
        plate: j['plate'] as String?,
        brand: j['brand'] as String?,
        model: j['model'] as String?,
      );
}

class FeedReport {
  final String id;
  final String category;
  final String description;
  final List<String> imageUrls;
  final double? latitude;
  final double? longitude;
  final DateTime createdAt;
  final FeedVehicle? vehicle;
  final String citizenName;
  final String? municipalityName;
  final String? provinceName;
  final int apoyosCount;
  final bool apoyado;
  /// Estado del reporte: 'pendiente', 'en_revision', 'validado'.
  /// Los reportes propios pendientes/en revisión solo son visibles para
  /// el dueño en el feed (estilo Instagram); 'validado' son públicos.
  final String status;
  /// `true` si el reporte fue creado por el usuario actual. Permite
  /// distinguir visualmente "tu publicación" en el feed.
  final bool isMine;

  const FeedReport({
    required this.id,
    required this.category,
    required this.description,
    required this.imageUrls,
    required this.createdAt,
    required this.citizenName,
    required this.apoyosCount,
    required this.apoyado,
    required this.status,
    required this.isMine,
    this.latitude,
    this.longitude,
    this.vehicle,
    this.municipalityName,
    this.provinceName,
  });

  factory FeedReport.fromJson(Map<String, dynamic> j) => FeedReport(
        id: j['id'] as String,
        category: j['category'] as String? ?? 'Otro',
        description: j['description'] as String? ?? '',
        imageUrls: (j['imageUrls'] as List? ?? const [])
            .map((e) => e as String)
            .toList(),
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? '') ??
            DateTime.now(),
        vehicle: j['vehicle'] != null
            ? FeedVehicle.fromJson(j['vehicle'] as Map<String, dynamic>)
            : null,
        citizenName: j['citizenName'] as String? ?? 'Ciudadano',
        municipalityName: j['municipalityName'] as String?,
        provinceName: j['provinceName'] as String?,
        apoyosCount: (j['apoyosCount'] as num?)?.toInt() ?? 0,
        apoyado: j['apoyado'] as bool? ?? false,
        status: j['status'] as String? ?? 'validado',
        isMine: j['isMine'] as bool? ?? false,
      );

  FeedReport copyWith({int? apoyosCount, bool? apoyado}) => FeedReport(
        id: id,
        category: category,
        description: description,
        imageUrls: imageUrls,
        latitude: latitude,
        longitude: longitude,
        createdAt: createdAt,
        vehicle: vehicle,
        citizenName: citizenName,
        municipalityName: municipalityName,
        provinceName: provinceName,
        apoyosCount: apoyosCount ?? this.apoyosCount,
        apoyado: apoyado ?? this.apoyado,
        status: status,
        isMine: isMine,
      );
}

enum FeedRegion {
  municipality('municipality', 'Mi distrito'),
  province('province', 'Mi provincia'),
  all('all', 'Todo Perú');

  const FeedRegion(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

enum FeedOrder {
  recent('recent', 'Recientes'),
  supported('supported', 'Más apoyados');

  const FeedOrder(this.apiValue, this.label);
  final String apiValue;
  final String label;
}
