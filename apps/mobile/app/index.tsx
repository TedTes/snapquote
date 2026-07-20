import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Mic,
  Plus,
  Search,
  Send,
  UploadCloud
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const statusCounts = [
  {
    label: "Draft",
    count: 6,
    color: "#2f6fed"
  },
  {
    label: "Sent",
    count: 9,
    color: "#0f8b62"
  },
  {
    label: "Viewed",
    count: 4,
    color: "#946200"
  },
  {
    label: "Stale",
    count: 3,
    color: "#b42318"
  }
];

const activeQuotes = [
  {
    customer: "Maya Chen",
    address: "18 Victor Ave",
    status: "Needs 2 prices",
    amount: "$--",
    accent: "#b42318"
  },
  {
    customer: "Ortega Family",
    address: "44 Wallace St",
    status: "Viewed today",
    amount: "$3,420",
    accent: "#0f8b62"
  },
  {
    customer: "Northline Cafe",
    address: "212 King St W",
    status: "Sent 4d ago",
    amount: "$1,870",
    accent: "#946200"
  }
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>SnapQuote</Text>
            <Text style={styles.title}>Today</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.iconButton}>
            <Search color="#101828" size={22} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" style={styles.primaryAction}>
          <Plus color="#ffffff" size={24} />
          <Text style={styles.primaryActionText}>New Quote</Text>
        </Pressable>

        <View style={styles.captureRow}>
          <Pressable accessibilityRole="button" style={styles.captureButton}>
            <Camera color="#101828" size={22} />
            <Text style={styles.captureButtonText}>Photos</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.captureButton}>
            <Mic color="#101828" size={22} />
            <Text style={styles.captureButtonText}>Voice</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.captureButton}>
            <UploadCloud color="#101828" size={22} />
            <Text style={styles.captureButtonText}>Queue</Text>
          </Pressable>
        </View>

        <View style={styles.statusGrid}>
          {statusCounts.map((item) => (
            <View key={item.label} style={styles.statusTile}>
              <Text style={[styles.statusCount, { color: item.color }]}>{item.count}</Text>
              <Text style={styles.statusLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Quotes</Text>
          <Pressable accessibilityRole="button" style={styles.iconButtonSmall}>
            <Send color="#101828" size={18} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Search color="#667085" size={18} />
          <TextInput
            accessibilityLabel="Search customers or addresses"
            placeholder="Search customers or addresses"
            placeholderTextColor="#667085"
            style={styles.searchInput}
          />
        </View>

        {activeQuotes.map((quote) => (
          <Pressable key={quote.customer} accessibilityRole="button" style={styles.quoteCard}>
            <View style={[styles.statusRail, { backgroundColor: quote.accent }]} />
            <View style={styles.quoteBody}>
              <View style={styles.quoteTopLine}>
                <Text style={styles.quoteCustomer}>{quote.customer}</Text>
                <Text style={styles.quoteAmount}>{quote.amount}</Text>
              </View>
              <Text style={styles.quoteAddress}>{quote.address}</Text>
              <View style={styles.quoteMetaRow}>
                {quote.status.startsWith("Needs") ? (
                  <AlertTriangle color="#b42318" size={16} />
                ) : quote.status.startsWith("Viewed") ? (
                  <CheckCircle2 color="#0f8b62" size={16} />
                ) : (
                  <Clock3 color="#946200" size={16} />
                )}
                <Text style={styles.quoteStatus}>{quote.status}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f7f9"
  },
  content: {
    padding: 20,
    gap: 18
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  kicker: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "700"
  },
  title: {
    color: "#101828",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0
  },
  iconButton: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    width: 46
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#101828",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    height: 58,
    justifyContent: "center"
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800"
  },
  captureRow: {
    flexDirection: "row",
    gap: 10
  },
  captureButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    height: 74,
    justifyContent: "center"
  },
  captureButtonText: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "700"
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statusTile: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 88,
    padding: 14,
    width: "48%"
  },
  statusCount: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0
  },
  statusLabel: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "700"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4
  },
  sectionTitle: {
    color: "#101828",
    fontSize: 20,
    fontWeight: "800"
  },
  iconButtonSmall: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    width: 38
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 48,
    paddingHorizontal: 14
  },
  searchInput: {
    color: "#101828",
    flex: 1,
    fontSize: 16
  },
  quoteCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 102,
    overflow: "hidden"
  },
  statusRail: {
    width: 6
  },
  quoteBody: {
    flex: 1,
    gap: 7,
    padding: 14
  },
  quoteTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  quoteCustomer: {
    color: "#101828",
    flex: 1,
    fontSize: 17,
    fontWeight: "800"
  },
  quoteAmount: {
    color: "#101828",
    fontSize: 17,
    fontWeight: "800"
  },
  quoteAddress: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "600"
  },
  quoteMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  quoteStatus: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700"
  }
});
