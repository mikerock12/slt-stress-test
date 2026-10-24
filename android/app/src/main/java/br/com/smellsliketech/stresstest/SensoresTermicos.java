package br.com.smellsliketech.stresstest;

import java.util.Locale;

// Só nomes que identificam o componente; bateria, carcaça, SoC genérico e PMIC ficam separados.
final class SensoresTermicos {
    static String componente(String tipo) {
        if (tipo == null) return null;
        String s = tipo.toLowerCase(Locale.ROOT).trim();
        if (s.matches(".*(battery|batt|skin|shell|pmic|charger|quiet|ambient).*")) return null;
        if (s.matches(".*(cpu|cpuss|tsens_tz_sensor_cpu).*")) return "cpu";
        if (s.matches(".*(gpu|mali).*" ) || s.matches("(?:mtkts)?mfg(?:[-_].*)?")) return "gpu";
        return null;
    }
    static Double miligraus(String bruto) {
        try {
            double t = Double.parseDouble(bruto.trim()) / 1000d;
            return Double.isFinite(t) && t > 0 && t < 150 ? t : null;
        } catch (Exception e) { return null; }
    }
}
