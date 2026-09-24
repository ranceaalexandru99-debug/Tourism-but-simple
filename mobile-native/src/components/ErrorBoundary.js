import { Component } from "react";
import { View, Text, Pressable } from "react-native";
import { report } from "../lib/monitor.js";

// Last-resort catch for render-time errors: instead of a dead white screen,
// the user gets a friendly recovery card and a retry button that re-mounts
// the tree. Sits OUTSIDE the theme/i18n providers — an error inside a provider
// must still render this — so the colours are self-contained: porcelain and
// antique gold, matching the default theme.
//
// The copy is self-contained too, and that is the point of the table below
// rather than an import. Importing i18n.js here would couple the crash screen
// to the very module it might be catching; three short strings do not justify
// that. It used to be Romanian with an English line underneath, which is a poor
// thing to show a Japanese user at the worst moment in the app.
//
// The language is read straight from storage, which the app hydrates before it
// renders anything. If that read fails — plausible, given something has already
// gone wrong — English stands in.
const LANG_KEY = "vai_lang";

const COPY = {
  en: { title: "Something went wrong", body: "The app hit an unexpected error. Your data is safe on this device.", retry: "Try again" },
  ro: { title: "Ceva n-a mers bine", body: "Aplicația a întâmpinat o eroare neașteptată. Datele tale sunt în siguranță pe dispozitiv.", retry: "Încearcă din nou" },
  fr: { title: "Une erreur est survenue", body: "L'application a rencontré une erreur inattendue. Tes données sont en sécurité sur cet appareil.", retry: "Réessayer" },
  es: { title: "Algo ha ido mal", body: "La aplicación ha sufrido un error inesperado. Tus datos están a salvo en este dispositivo.", retry: "Reintentar" },
  it: { title: "Qualcosa è andato storto", body: "L'app ha riscontrato un errore imprevisto. I tuoi dati sono al sicuro su questo dispositivo.", retry: "Riprova" },
  de: { title: "Etwas ist schiefgelaufen", body: "In der App ist ein unerwarteter Fehler aufgetreten. Deine Daten sind auf diesem Gerät sicher.", retry: "Erneut versuchen" },
  pt: { title: "Algo correu mal", body: "A aplicação encontrou um erro inesperado. Os teus dados estão seguros neste dispositivo.", retry: "Tentar de novo" },
  nl: { title: "Er ging iets mis", body: "De app liep tegen een onverwachte fout aan. Je gegevens staan veilig op dit apparaat.", retry: "Opnieuw proberen" },
  pl: { title: "Coś poszło nie tak", body: "W aplikacji wystąpił nieoczekiwany błąd. Twoje dane są bezpieczne na tym urządzeniu.", retry: "Spróbuj ponownie" },
  ru: { title: "Что-то пошло не так", body: "В приложении произошла непредвиденная ошибка. Ваши данные в безопасности на этом устройстве.", retry: "Попробовать снова" },
  zh: { title: "出了点问题", body: "应用遇到了意外错误。你的数据已安全保存在本机上。", retry: "重试" },
  ja: { title: "問題が発生しました", body: "予期しないエラーが発生しました。データはこの端末に安全に保存されています。", retry: "再試行" },
  tr: { title: "Bir şeyler ters gitti", body: "Uygulamada beklenmeyen bir hata oluştu. Verilerin bu cihazda güvende.", retry: "Tekrar dene" },
  el: { title: "Κάτι πήγε στραβά", body: "Η εφαρμογή αντιμετώπισε ένα απρόσμενο σφάλμα. Τα δεδομένα σου είναι ασφαλή σε αυτή τη συσκευή.", retry: "Δοκίμασε ξανά" },
  uk: { title: "Щось пішло не так", body: "У застосунку сталася неочікувана помилка. Твої дані в безпеці на цьому пристрої.", retry: "Спробувати ще раз" },
  ko: { title: "문제가 발생했습니다", body: "앱에서 예기치 않은 오류가 발생했습니다. 데이터는 이 기기에 안전하게 저장되어 있습니다.", retry: "다시 시도" },
};

function copy() {
  try {
    const lang = localStorage.getItem(LANG_KEY);
    if (lang && COPY[lang]) return COPY[lang];
  } catch { /* storage is unreadable — which may be why we are here */ }
  return COPY.en;
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    report("render", error?.message || String(error), info?.componentStack || error?.stack);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const c = copy();
    return (
      <View style={{
        flex: 1, backgroundColor: "#FBFAF7",
        alignItems: "center", justifyContent: "center", padding: 32,
      }}>
        <Text style={{ fontSize: 44, marginBottom: 14 }}>🧭</Text>
        <Text style={{ color: "#2A2C31", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
          {c.title}
        </Text>
        <Text style={{ color: "#777163", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 24 }}>
          {c.body}
        </Text>
        <Pressable
          onPress={this.retry}
          accessibilityLabel={c.retry}
          style={({ pressed }) => ({
            backgroundColor: "#8B6E27", opacity: pressed ? 0.85 : 1,
            borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{c.retry}</Text>
        </Pressable>
      </View>
    );
  }
}
