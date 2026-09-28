# frozen_string_literal: true

# Exports the JSON Schema of the Relaton v3 bibliographic models from the
# lutaml-model definitions in relaton/relaton (see tools/Gemfile for the pin).
#
# Output:
#   schema/manifest.json            — what was exported, from which ref
#   schema/bib-item.schema.json     — generic Relaton::Bib::Item
#   schema/ietf-item.schema.json    — flavor Relaton::Ietf::Item (ext.stream & co)
#
# lutaml-model 0.8.61 (#867) fixed the schema-generator defects filed as
# lutaml/lutaml-model#863 (recursion) and #864 (nested choice), and #865's fix
# now renders choice faithfully — as `allOf` of required-discriminated
# `oneOf`s. But the Relaton emitters do not honour choice constraints
# (relations serialize with no locality keys at all), so that faithful schema
# rejects the real corpus. The strip in #export_schema drops the choice
# wrappers on both the 0.8.60 and 0.8.61 renderings: relaton-ts validates
# shape, and the golden fixtures pin the choice semantics at runtime.

require "json"
require "bundler/setup"
require "lutaml/model"
require "relaton/bib"
require "relaton/ietf"

source_ref = File.read(File.join(__dir__, "Gemfile"))
                 .match(/ref:\s*"([0-9a-f]{40})"/)&.[](1) or raise "no ref pin in tools/Gemfile"

# choice_fragment: a bare {properties:, required:} object for one member —
# the branch shape 0.8.61 renders for every choice member.
CHOICE_FRAGMENT = lambda do |b|
  b.is_a?(Hash) && b["type"] == "object" && b["properties"].is_a?(Hash) &&
    b["required"].is_a?(Array) && !b.key?("additionalProperties")
end

# Member property names of one rendered choice group: 0.8.60 renders a whole
# group as one {properties:} branch, 0.8.61 renders each member as a fragment
# ({properties:, required:}) and nests wrappers around fragments.
choice_group_members = lambda do |group|
  return group["properties"].keys if group.is_a?(Hash) && group["properties"].is_a?(Hash)

  return [] unless group.is_a?(Hash)

  %w[anyOf allOf oneOf].flat_map do |k|
    next [] unless group[k].is_a?(Array)

    group[k].flat_map { |f| choice_group_members.call(f) }.uniq
  end
end

# Member property names of one expanded-XOR branch (0.8.76): an allOf of
# the group fragment ({properties:, required:}) and not-required guards for
# the other members.
xor_branch_members = lambda do |branch|
  return [] unless branch.is_a?(Hash) && branch["allOf"].is_a?(Array)

  branch["allOf"].filter_map do |sub|
    sub["required"] if sub.is_a?(Hash) && sub["required"].is_a?(Array) && !sub.key?("not")
  end.flatten.uniq
end

# The rendering shapes, per lutaml-model version, each yielding the list of
# choice groups (a group = one `choice do ... end` block's members):
#   0.8.60: def-level oneOf, each branch a whole group
#   0.8.61: def-level allOf of oneOf, each oneOf a group of fragments
#   0.8.61 nested (Date): def-level anyOf of fragments and/or nested wrappers
#   0.8.74+: expanded XOR — oneOf of [not-anyOf(all members)] plus one allOf
#   branch per group (fragment required + not-required the others)
CHOICE_GROUPS = lambda do |d|
  if d["oneOf"].is_a?(Array) && d["oneOf"].first.is_a?(Hash) &&
      d["oneOf"].first["not"].is_a?(Hash) &&
      d["oneOf"].drop(1).all? { |b| b.is_a?(Hash) && b["allOf"].is_a?(Array) }
    members = d["oneOf"].drop(1).map { |b| xor_branch_members.call(b) }
    return members unless members.any?(&:empty?)
  end
  if d["oneOf"].is_a?(Array)
    members = d["oneOf"].map { |b| choice_group_members.call(b) }
    return members unless members.any?(&:empty?)
  end
  if d["allOf"].is_a?(Array) && d["allOf"].all? { |b| b.is_a?(Hash) && b["oneOf"].is_a?(Array) }
    members = d["allOf"].map do |b|
      b["oneOf"].flat_map { |f| choice_group_members.call(f) }.uniq
    end
    return members unless members.any?(&:empty?)
  end
  if d["anyOf"].is_a?(Array)
    members = d["anyOf"].map { |b| choice_group_members.call(b) }
    return members unless members.any?(&:empty?)
  end
  nil
end

# Fallback for defs whose emitted schema carries no choice composition at
# all — nested choices (BibDate's from/to vs at) are not emitted in the
# 0.8.74+ encoding, while top-level choices are. The declared groups are
# model truth, so read them from choice_attributes: a branch that is a
# nested choice flattens to its member attributes.
MODEL_CHOICE_GROUPS = lambda do |def_name|
  klass = begin
    Object.const_get(def_name.gsub("_", "::"))
  rescue NameError, LoadError
    nil
  end
  return nil unless klass.is_a?(Class) && klass.respond_to?(:choice_attributes)

  groups = klass.choice_attributes.flat_map do |choice|
    choice.attributes.filter_map do |branch|
      if branch.respond_to?(:name)
        [branch.name.to_s]
      elsif branch.respond_to?(:attributes)
        names = branch.attributes.filter_map { |a| a.name.to_s if a.respond_to?(:name) }
        names.empty? ? nil : names
      end
    end
  end
  groups.empty? ? nil : groups
end

def export_schema(klass)
  schema = JSON.parse(Lutaml::Json::Schema::JsonSchema.generate(klass))

  schema["$defs"].each do |name, d|
    next unless d.is_a?(Hash)

    groups = CHOICE_GROUPS.call(d) || MODEL_CHOICE_GROUPS.call(name)
    if groups
      # The emitters do not honour choice min-presence (relations serialize
      # with no locality keys at all — lutaml/lutaml-model#869), so presence
      # is not enforceable. Exclusivity — at most one group present — is
      # honoured by the corpus, and is enforced downstream in relaton-ts.
      d["x-choice-exclusive-groups"] = groups
      d.delete("oneOf")
      d.delete("allOf")
      d.delete("anyOf")
    end
  end
  schema
end

ROOTS = {
  "bib-item.schema.json" => Relaton::Bib::Item,
  "ietf-item.schema.json" => Relaton::Ietf::Item,
}.freeze

ROOTS.each do |file, klass|
  path = File.join(__dir__, "..", "schema", file)
  File.write(path, JSON.pretty_generate(export_schema(klass)))
  puts "wrote schema/#{file} (#{JSON.parse(File.read(path))['$defs'].size} defs)"
end

manifest = {
  source: "relaton/relaton",
  ref: source_ref,
  # No generation timestamp: the manifest must be byte-stable across runs,
  # so CI can verify the committed artifact by regenerating it.
  lutaml_model_version: Lutaml::Model::VERSION,
  roots: ROOTS.keys.map { |f| "schema/#{f}" },
}
File.write(File.join(__dir__, "..", "schema", "manifest.json"), JSON.pretty_generate(manifest))
puts "wrote schema/manifest.json"
