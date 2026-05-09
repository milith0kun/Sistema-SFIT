// Modelos de datos para el sistema de SFITCoins y recompensas (RF-15 / RF-16).

class CoinTransaction {
  final String id;
  final String type; // 'ganado' | 'canjeado'
  final int amount;
  final String reason;
  final int balance;
  final DateTime date;

  const CoinTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.reason,
    required this.balance,
    required this.date,
  });

  factory CoinTransaction.fromJson(Map<String, dynamic> j) => CoinTransaction(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? '',
        amount: (j['amount'] as num?)?.toInt() ?? 0,
        reason: j['reason'] as String? ?? '',
        balance: (j['balance'] as num?)?.toInt() ?? 0,
        date: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  /// Etiqueta legible para la razón de la transacción.
  String get reasonLabel => switch (reason) {
        'reporte_enviado'   => 'Reporte enviado',
        'reporte_validado'  => 'Reporte validado',
        'canje_recompensa'  => 'Canje de recompensa',
        _                   => reason,
      };
}

class RewardItem {
  final String id;
  final String name;
  final String description;
  final int cost;
  final String category;
  final int stock; // -1 = ilimitado

  const RewardItem({
    required this.id,
    required this.name,
    required this.description,
    required this.cost,
    required this.category,
    required this.stock,
  });

  factory RewardItem.fromJson(Map<String, dynamic> j) {
    final cat = j['category'] as String? ?? '';
    return RewardItem(
      id:          j['id'] as String? ?? '',
      name:        j['name'] as String? ?? _defaultName(cat),
      description: j['description'] as String? ?? '',
      cost:        (j['cost'] as num?)?.toInt() ?? 0,
      category:    cat,
      stock:       (j['stock'] as num?)?.toInt() ?? -1,
    );
  }

  static String _defaultName(String category) => switch (category) {
        'descuento'   => 'Cupón de descuento',
        'bono'        => 'Bono ciudadano',
        'transporte'  => 'Beneficio de transporte',
        'salud'       => 'Beneficio de salud',
        'ocio'        => 'Beneficio cultural',
        'certificado' => 'Certificado ciudadano',
        'beneficio'   => 'Beneficio especial',
        _             => 'Recompensa',
      };

  bool get hasStock => stock == -1 || stock > 0;

  String get stockLabel => stock == -1 ? 'Ilimitado' : '$stock disponibles';
}

class CoinsStatus {
  final int balance;
  final int nivel;
  final List<CoinTransaction> transactions;

  const CoinsStatus({
    required this.balance,
    required this.nivel,
    required this.transactions,
  });

  factory CoinsStatus.fromJson(Map<String, dynamic> j) => CoinsStatus(
        balance: (j['balance'] as num?)?.toInt() ?? 0,
        nivel: (j['nivel'] as num?)?.toInt() ?? 1,
        transactions: ((j['transactions'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => CoinTransaction.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );

  /// Etiqueta del nivel.
  String get nivelLabel => switch (nivel) {
        1 => 'Bronce',
        2 => 'Plata',
        3 => 'Oro',
        4 => 'Platino',
        _ => 'Bronce',
      };
}
