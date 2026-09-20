import 'package:flutter/material.dart';

class HeroIllustration extends StatelessWidget {
  const HeroIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 180,
        height: 104,
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFF2FBFD), Color(0xFFE5F4F8)],
          ),
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Column(
          children: [
            Text(
              'ĐO MỨC ĐỘ STRESS',
              style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800),
            ),
            Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('💧', style: TextStyle(fontSize: 34)),
                SizedBox(width: 9),
                Text('🌞', style: TextStyle(fontSize: 51)),
                SizedBox(width: 4),
                Text('☁️', style: TextStyle(fontSize: 28)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
